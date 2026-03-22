import { prisma } from "@repo/db";
import { randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { createWorkerRuntime, PDF_QUEUE_NAME } from "./index.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("pdf finalization worker integration", () => {
  test("processes job, stores artifact, and writes activity", async () => {
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
      return;
    }
    const workspaceId = `it-workspace-${randomUUID()}`;
    const documentId = `it-document-${randomUUID()}`;
    const artifactsRoot = path.join(tmpdir(), `proposal-worker-it-${randomUUID()}`);
    const pdfKey = `documents/${workspaceId}/${documentId}/integration-test.pdf`;

    const originalEnv = {
      PDF_LOCAL_ARTIFACTS_DIR: process.env.PDF_LOCAL_ARTIFACTS_DIR,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_REGION: process.env.S3_REGION,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    };
    process.env.PDF_LOCAL_ARTIFACTS_DIR = artifactsRoot;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "audit_retention_days" INTEGER NOT NULL DEFAULT 90',
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "audit_export_token_ttl_minutes" INTEGER NOT NULL DEFAULT 15',
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "cpq_approval_discount_threshold" INTEGER NOT NULL DEFAULT 15',
    );

    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "Worker Integration Workspace",
      },
    });
    await prisma.document.create({
      data: {
        id: documentId,
        workspace_id: workspaceId,
        template_id: null,
        editor_json: { type: "doc", content: [] },
        schema_version: 1,
        doc_version: 1,
        status: "PAID",
        variables_json: {},
        pricing_json: { currency: "USD", items: [] },
        recipients_json: [],
      },
    });

    const runtime = createWorkerRuntime(process.env.REDIS_URL);
    try {
      await runtime.pdfQueue.add("finalize-document-pdf", {
        documentId,
        workspaceId,
        html: "<html><body><h1>Integration PDF</h1></body></html>",
        docHash: `hash-${randomUUID()}`,
        pdfKey,
        certificate: {
          finalizedAt: new Date().toISOString(),
          actorUserId: "integration-user",
        },
        generatedAt: new Date().toISOString(),
      });

      let storedEvent:
        | {
            id: string;
            metadata_json: unknown;
          }
        | null = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        storedEvent = await prisma.documentActivityEvent.findFirst({
          where: {
            workspace_id: workspaceId,
            document_id: documentId,
            event_type: "DOCUMENT_PDF_STORED",
          },
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            metadata_json: true,
          },
        });
        if (storedEvent) {
          break;
        }
        await sleep(250);
      }

      expect(storedEvent).toBeTruthy();
      const metadata = (storedEvent?.metadata_json as Record<string, unknown>) ?? {};
      expect(metadata.pdfKey).toBe(pdfKey);
      expect(metadata.storageType).toBe("local");
      expect(typeof metadata.checksum).toBe("string");

      const artifactPath = path.resolve(artifactsRoot, pdfKey);
      const artifactStats = await stat(artifactPath);
      expect(artifactStats.size).toBeGreaterThan(100);

      const artifactUrl = pathToFileURL(artifactPath);
      const artifactBytes = await readFile(artifactUrl);
      expect(artifactBytes.length).toBeGreaterThan(100);
      expect(artifactUrl.toString().startsWith("file://")).toBe(true);
      expect(PDF_QUEUE_NAME).toBe("pdf-finalization-jobs");

      const persistedDocument = await prisma.document.findUnique({
        where: { id: documentId },
        select: { status: true, doc_hash: true, finalized_pdf_key: true },
      });
      expect(persistedDocument?.status).toBe("PAID");
      expect(persistedDocument?.doc_hash).toBeTypeOf("string");
      expect(persistedDocument?.finalized_pdf_key).toBe(pdfKey);
    } finally {
      await runtime.worker.close();
      await runtime.pdfWorker.close();
      await runtime.webhookWorker.close();
      await runtime.queue.close();
      await runtime.pdfQueue.close();
      await runtime.webhookQueue.close();
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
      await rm(artifactsRoot, { recursive: true, force: true }).catch(() => {});

      process.env.PDF_LOCAL_ARTIFACTS_DIR = originalEnv.PDF_LOCAL_ARTIFACTS_DIR;
      process.env.S3_ENDPOINT = originalEnv.S3_ENDPOINT;
      process.env.S3_BUCKET = originalEnv.S3_BUCKET;
      process.env.S3_REGION = originalEnv.S3_REGION;
      process.env.S3_ACCESS_KEY_ID = originalEnv.S3_ACCESS_KEY_ID;
      process.env.S3_SECRET_ACCESS_KEY = originalEnv.S3_SECRET_ACCESS_KEY;
    }
  }, 30000);
});
