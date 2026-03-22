import { Queue, type ConnectionOptions } from "bullmq";
import type { PdfFinalizationJobPayload } from "@repo/shared";

const PDF_QUEUE_NAME = "pdf-finalization-jobs";

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };
}

export async function enqueuePdfFinalizationJob(payload: PdfFinalizationJobPayload): Promise<string> {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const queue = new Queue(PDF_QUEUE_NAME, { connection: parseRedisConnection(redisUrl) });
  const jobId = `pdf-finalize:${payload.documentId}:${payload.docHash}`;

  try {
    const job = await queue.add("finalize-document-pdf", payload, {
      jobId,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
    return job.id ?? jobId;
  } finally {
    await queue.close();
  }
}
