import { Queue, Worker, type ConnectionOptions } from "bullmq";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { createHash, createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { PdfFinalizationJobPayload, WebhookDeliveryJobPayload } from "@repo/shared";
import { Agent } from "undici";
import { logWorkerEvent } from "./logger.js";

export const QUEUE_NAME = "background-jobs";
export const PDF_QUEUE_NAME = "pdf-finalization-jobs";
export const WEBHOOK_QUEUE_NAME = "webhook-delivery-jobs";

let mtlsDispatcherPromise: Promise<Agent> | null = null;

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function computeNextRetryAt(attempt: number): Date {
  const delayMs = Math.min(60000, Math.max(1000, 2000 * 2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + delayMs);
}

function createWebhookSignature(secret: string, payload: string, timestamp: string): string {
  const base = `${timestamp}.${payload}`;
  return createHmac("sha256", secret).update(base).digest("hex");
}

async function getMtlsDispatcher(): Promise<Agent> {
  if (mtlsDispatcherPromise) {
    return mtlsDispatcherPromise;
  }
  mtlsDispatcherPromise = (async () => {
    const certPath = process.env.WEBHOOK_MTLS_CERT_PATH;
    const keyPath = process.env.WEBHOOK_MTLS_KEY_PATH;
    const caPath = process.env.WEBHOOK_MTLS_CA_PATH;
    if (!certPath || !keyPath) {
      throw new Error("WEBHOOK_MTLS_CERT_PATH and WEBHOOK_MTLS_KEY_PATH are required when mTLS is enabled");
    }
    const [cert, key, ca] = await Promise.all([
      readFile(certPath, "utf8"),
      readFile(keyPath, "utf8"),
      caPath ? readFile(caPath, "utf8") : Promise.resolve(undefined),
    ]);
    return new Agent({
      connect: {
        cert,
        key,
        ca,
      },
    });
  })();
  return mtlsDispatcherPromise;
}

function parseAllowedIps(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && net.isIP(item) !== 0);
}

async function endpointMatchesAllowedIps(endpointUrl: string, allowedIps: string[]): Promise<boolean> {
  if (allowedIps.length === 0) {
    return true;
  }
  const parsed = new URL(endpointUrl);
  const host = parsed.hostname;
  if (net.isIP(host) !== 0) {
    return allowedIps.includes(host);
  }
  const resolved = await lookup(host, { all: true }).catch(() => []);
  return resolved.some((record) => allowedIps.includes(record.address));
}

async function uploadPdfArtifact(pdfBytes: Buffer, pdfKey: string): Promise<{
  storageType: "s3" | "local";
  location: string;
}> {
  const s3 = getS3Config();
  if (!s3) {
    const localDir = process.env.PDF_LOCAL_ARTIFACTS_DIR ?? path.resolve(process.cwd(), ".artifacts", "pdfs");
    const targetPath = path.resolve(localDir, pdfKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, pdfBytes);
    const file = await stat(targetPath);
    if (!file.isFile() || file.size <= 0) {
      throw new Error(`Local artifact write verification failed for ${targetPath}`);
    }
    return {
      storageType: "local",
      location: targetPath,
    };
  }

  const client = new S3Client({
    region: s3.region,
    endpoint: s3.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
  });
  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: s3.bucket,
      }),
    );
  } catch {
    await client.send(
      new CreateBucketCommand({
        Bucket: s3.bucket,
      }),
    );
  }
  await client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: pdfKey,
      Body: pdfBytes,
      ContentType: "application/pdf",
    }),
  );
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: s3.bucket,
      Key: pdfKey,
    }),
  );
  if (!head.ContentLength || Number(head.ContentLength) <= 0) {
    throw new Error(`S3 object verification failed for ${s3.bucket}/${pdfKey}`);
  }
  return {
    storageType: "s3",
    location: `${s3.bucket}/${pdfKey}`,
  };
}

function createWorkerProbeServer(input: {
  port: number;
  runtime: {
    worker: Worker;
    pdfWorker: Worker;
    webhookWorker: Worker;
  };
}) {
  const startedAt = new Date().toISOString();
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/health") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          ok: true,
          status: "healthy",
          service: "worker",
          startedAt,
          now: new Date().toISOString(),
        }),
      );
      return;
    }
    if (requestUrl.pathname === "/ready") {
      const [mainReady, pdfReady, webhookReady] = await Promise.all([
        input.runtime.worker.isRunning(),
        input.runtime.pdfWorker.isRunning(),
        input.runtime.webhookWorker.isRunning(),
      ]);
      const ready = mainReady && pdfReady && webhookReady;
      response.statusCode = ready ? 200 : 503;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          ok: ready,
          status: ready ? "ready" : "not_ready",
          service: "worker",
          checks: {
            mainWorker: mainReady ? "ok" : "fail",
            pdfWorker: pdfReady ? "ok" : "fail",
            webhookWorker: webhookReady ? "ok" : "fail",
          },
          now: new Date().toISOString(),
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  });

  server.listen(input.port, "0.0.0.0", () => {
    logWorkerEvent("info", "worker.probe_server_started", {
      port: input.port,
    });
  });
  return server;
}

export function createWorkerRuntime(redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379") {
  const connection = parseRedisConnection(redisUrl);
  const queue = new Queue(QUEUE_NAME, { connection });
  const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection });
  const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logWorkerEvent("info", "worker.job_processed", {
        queue: QUEUE_NAME,
        jobId: job.id,
        jobName: job.name,
      });
    },
    { connection },
  );
  const pdfWorker = new Worker(
    PDF_QUEUE_NAME,
    async (job) => {
      const payload = job.data as PdfFinalizationJobPayload;
      const correlationId = payload.correlationId ?? `pdf-job:${String(job.id ?? "unknown")}`;
      const document = await prisma.document.findFirst({
        where: {
          id: payload.documentId,
          workspace_id: payload.workspaceId,
        },
      });
      if (!document) {
        throw new Error(`Document ${payload.documentId} not found`);
      }
      const priorStoredEvents = await prisma.documentActivityEvent.findMany({
        where: {
          workspace_id: payload.workspaceId,
          document_id: payload.documentId,
          event_type: "DOCUMENT_PDF_STORED",
        },
        orderBy: { created_at: "desc" },
        take: 25,
      });
      const alreadyStored = priorStoredEvents.some((event) => {
        const metadata = (event.metadata_json as Record<string, unknown>) ?? {};
        return metadata.hash === payload.docHash && metadata.pdfKey === payload.pdfKey;
      });
      if (alreadyStored) {
        logWorkerEvent("info", "pdf.finalize_idempotent", {
          documentId: payload.documentId,
          correlationId,
        });
        return;
      }

      const pdfBytes = await renderPdfBuffer(payload.html);
      const checksum = createHash("sha256").update(pdfBytes).digest("hex");
      const uploaded = await uploadPdfArtifact(pdfBytes, payload.pdfKey);
      await prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: payload.documentId },
          data: {
            doc_hash: payload.docHash,
            finalized_pdf_key: payload.pdfKey,
          },
        });

        await tx.documentActivityEvent.create({
          data: {
            workspace_id: payload.workspaceId,
            document_id: payload.documentId,
            event_type: "DOCUMENT_PDF_STORED",
            metadata_json: {
              correlationId,
              hash: payload.docHash,
              pdfKey: payload.pdfKey,
              certificate: payload.certificate,
              htmlLength: payload.html.length,
              checksum,
              storageType: uploaded.storageType,
              storageLocation: uploaded.location,
              pdfBytes: pdfBytes.length,
            },
          },
        });
      });

      // Playwright PDF generation hook point: HTML payload is ready for rendering.
      logWorkerEvent("info", "pdf.finalize_stored", {
        documentId: payload.documentId,
        pdfKey: payload.pdfKey,
        checksum: checksum.slice(0, 12),
        correlationId,
      });
    },
    { connection },
  );
  const webhookWorker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      const payload = job.data as WebhookDeliveryJobPayload;
      const correlationId = payload.correlationId ?? `webhook-job:${String(job.id ?? "unknown")}`;
      const delivery = await prisma.webhookDelivery.findUnique({
        where: { id: payload.deliveryId },
        include: { endpoint: true },
      });
      if (!delivery) {
        throw new Error(`Webhook delivery ${payload.deliveryId} not found`);
      }
      if (delivery.status === "SUCCESS" || delivery.status === "DEAD_LETTER") {
        return;
      }

      const attempt = job.attemptsMade + 1;
      const serializedPayload = JSON.stringify(delivery.payload_json);
      const timestamp = new Date().toISOString();
      const signature = createWebhookSignature(delivery.endpoint.secret, serializedPayload, timestamp);
      const allowedIps = parseAllowedIps(delivery.endpoint.allowed_ips_json);
      const ipMatch = await endpointMatchesAllowedIps(delivery.endpoint.url, allowedIps);
      if (!ipMatch) {
        const responseBody = "Endpoint IP is not allowed by webhook policy";
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "DEAD_LETTER",
            attempts: attempt,
            signature,
            response_body: responseBody,
            next_retry_at: null,
          },
        });
        logWorkerEvent("error", "webhook.delivery_policy_blocked_ip", {
          deliveryId: delivery.id,
          correlationId,
          allowedIps,
        });
        return;
      }
      if (delivery.endpoint.require_mtls && process.env.WEBHOOK_MTLS_ENABLED !== "true") {
        const responseBody = "Webhook requires mTLS but worker is not configured for mTLS";
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "DEAD_LETTER",
            attempts: attempt,
            signature,
            response_body: responseBody,
            next_retry_at: null,
          },
        });
        logWorkerEvent("error", "webhook.delivery_policy_blocked_mtls", {
          deliveryId: delivery.id,
          correlationId,
          mtlsFingerprint: delivery.endpoint.mtls_cert_fingerprint,
        });
        return;
      }
      const dispatcher =
        delivery.endpoint.require_mtls && process.env.WEBHOOK_MTLS_ENABLED === "true"
          ? await getMtlsDispatcher()
          : undefined;

      let statusCode: number | undefined;
      let responseBody: string | undefined;
      try {
        const response = await fetch(delivery.endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-proposal-signature": signature,
            "x-proposal-timestamp": timestamp,
            "x-proposal-event": delivery.event_type,
            "x-proposal-delivery-id": delivery.id,
            "x-request-id": correlationId,
            "x-proposal-correlation-id": correlationId,
          },
          body: serializedPayload,
          signal: AbortSignal.timeout(10000),
          ...(dispatcher ? { dispatcher } : {}),
        } as RequestInit);
        statusCode = response.status;
        responseBody = (await response.text()).slice(0, 2000);

        if (response.ok) {
          logWorkerEvent("info", "webhook.delivery_success", {
            deliveryId: delivery.id,
            statusCode,
            correlationId,
          });
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SUCCESS",
              attempts: attempt,
              signature,
              http_status: statusCode,
              response_body: responseBody,
              delivered_at: new Date(),
              next_retry_at: null,
            },
          });
          return;
        }

        const deadLetter = attempt >= 5;
        logWorkerEvent("warn", "webhook.delivery_non_2xx", {
          deliveryId: delivery.id,
          statusCode,
          deadLetter,
          correlationId,
        });
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: deadLetter ? "DEAD_LETTER" : "RETRYING",
            attempts: attempt,
            signature,
            http_status: statusCode,
            response_body: responseBody,
            next_retry_at: deadLetter ? null : computeNextRetryAt(attempt),
          },
        });
        if (!deadLetter) {
          throw new Error(`Webhook endpoint returned status ${statusCode}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Webhook delivery failed";
        const deadLetter = attempt >= 5;
        logWorkerEvent("error", "webhook.delivery_error", {
          deliveryId: delivery.id,
          deadLetter,
          correlationId,
          message,
        });
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: deadLetter ? "DEAD_LETTER" : "RETRYING",
            attempts: attempt,
            signature,
            http_status: statusCode,
            response_body: responseBody ?? message.slice(0, 2000),
            next_retry_at: deadLetter ? null : computeNextRetryAt(attempt),
          },
        });
        if (!deadLetter) {
          throw error;
        }
      }
    },
    { connection },
  );

  worker.on("ready", () => {
    logWorkerEvent("info", "worker.ready", { queue: QUEUE_NAME });
  });

  worker.on("failed", (job, error) => {
    logWorkerEvent("error", "worker.job_failed", {
      queue: QUEUE_NAME,
      jobId: job?.id ?? "unknown",
      message: error.message,
    });
  });
  pdfWorker.on("failed", (job, error) => {
    logWorkerEvent("error", "worker.job_failed", {
      queue: PDF_QUEUE_NAME,
      jobId: job?.id ?? "unknown",
      message: error.message,
    });
  });
  webhookWorker.on("failed", (job, error) => {
    logWorkerEvent("error", "worker.job_failed", {
      queue: WEBHOOK_QUEUE_NAME,
      jobId: job?.id ?? "unknown",
      message: error.message,
    });
  });

  return { queue, worker, pdfQueue, pdfWorker, webhookQueue, webhookWorker };
}

export async function startWorkerProcess() {
  const runtime = createWorkerRuntime();
  const probePort = Number(process.env.WORKER_HEALTH_PORT ?? "8081");
  const probeServer = Number.isFinite(probePort) && probePort > 0
    ? createWorkerProbeServer({
        port: probePort,
        runtime,
      })
    : null;

  const shutdown = async (signal: string) => {
    logWorkerEvent("warn", "worker.shutdown_requested", { signal });
    if (probeServer) {
      await new Promise<void>((resolve) => probeServer.close(() => resolve()));
    }
    if (mtlsDispatcherPromise) {
      const dispatcher = await mtlsDispatcherPromise.catch(() => null);
      if (dispatcher) {
        await dispatcher.close().catch(() => {});
      }
    }
    await runtime.worker.close();
    await runtime.pdfWorker.close();
    await runtime.webhookWorker.close();
    await runtime.queue.close();
    await runtime.pdfQueue.close();
    await runtime.webhookQueue.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  logWorkerEvent("info", "worker.started", {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    probePort: probeServer ? probePort : null,
  });
}

const isExecutedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isExecutedDirectly) {
  startWorkerProcess().catch((error) => {
    logWorkerEvent("error", "worker.start_failed", {
      message: error instanceof Error ? error.message : "Unknown startup error",
    });
    process.exit(1);
  });
}
