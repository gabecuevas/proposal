import type { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { finalizeDocument } from "@/lib/editor/document-store";
import { enqueuePdfFinalizationJob } from "@/lib/jobs/pdf-finalization-queue";
import { logApiEvent } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { enqueueWebhookEvent } from "@/lib/webhooks/queue";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const result = await finalizeDocument({
    documentId,
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  let queued = false;
  let jobId: string | null = null;
  try {
    jobId = await enqueuePdfFinalizationJob({
      documentId,
      workspaceId: auth.workspaceId,
      correlationId: requestId,
      html: result.html,
      docHash: result.doc_hash,
      pdfKey: result.pdf_key,
      certificate: result.certificate,
      generatedAt: new Date().toISOString(),
    });
    queued = true;
    await prisma.documentActivityEvent.create({
      data: {
        workspace_id: auth.workspaceId,
        document_id: documentId,
        event_type: "DOCUMENT_PDF_JOB_QUEUED",
        actor_user_id: auth.userId,
        metadata_json: {
          jobId,
          hash: result.doc_hash,
          pdfKey: result.pdf_key,
          correlationId: requestId,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue pdf finalization job";
    await prisma.documentActivityEvent.create({
      data: {
        workspace_id: auth.workspaceId,
        document_id: documentId,
        event_type: "DOCUMENT_PDF_JOB_QUEUE_FAILED",
        actor_user_id: auth.userId,
        metadata_json: {
          error: message,
          hash: result.doc_hash,
          pdfKey: result.pdf_key,
          correlationId: requestId,
        },
      },
    });
  }

  await enqueueWebhookEvent({
    workspaceId: auth.workspaceId,
    eventType: "document.finalized",
    documentId,
    actorUserId: auth.userId,
    correlationId: requestId,
    payload: {
      type: "document.finalized",
      document: {
        id: documentId,
        docHash: result.doc_hash,
        pdfKey: result.pdf_key,
      },
      occurredAt: result.certificate.finalizedAt,
    },
  }).catch(() => {});

  logApiEvent(request, {
    event: "document.finalized",
    requestId,
    status: 200,
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    details: {
      documentId,
      queued,
      jobId,
      pdfKey: result.pdf_key,
      docHash: result.doc_hash,
    },
  });
  return jsonWithRequestId(request, {
    ...result,
    queued,
    jobId,
    requestId,
  });
}
