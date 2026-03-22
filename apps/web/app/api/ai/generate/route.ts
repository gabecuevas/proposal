import type { NextRequest } from "next/server";
import { aiGenerateRequestSchema } from "@repo/shared";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { executeAiGeneration } from "@/lib/ai/service";
import { getRequestId } from "@/lib/observability/request-id";
import { logApiEvent } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = aiGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Invalid AI request payload",
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  try {
    const result = await executeAiGeneration({
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      requestId,
      request: parsed.data,
    });

    logApiEvent(request, {
      event: "ai.generation.completed",
      requestId,
      status: 200,
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      details: {
        task: result.task,
        provider: result.provider,
        model: result.model,
        documentId: result.context.documentId,
        templateId: result.context.templateId,
      },
    });
    return jsonWithRequestId(request, { result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    if (message === "Document not found") {
      return errorResponse(request, {
        status: 404,
        code: "document_not_found",
        message,
      });
    }
    if (message === "Template not found") {
      return errorResponse(request, {
        status: 404,
        code: "template_not_found",
        message,
      });
    }
    if (message.includes("not configured")) {
      return errorResponse(request, {
        status: 503,
        code: "ai_not_configured",
        message,
      });
    }
    return errorResponse(request, {
      status: 502,
      code: "ai_generation_failed",
      message,
    });
  }
}
