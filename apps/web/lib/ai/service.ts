import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import type { AiGenerateRequest } from "@repo/shared";
import { getDocument } from "@/lib/editor/document-store";
import { getTemplate } from "@/lib/editor/template-store";
import { resolveTemplateVariables } from "@/lib/editor/variables";
import type { PricingModel, VariableContext, VariableRegistry } from "@/lib/editor/types";
import { buildAiPrompts, type AiPromptContext } from "./prompt-builder";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type ExecuteAiInput = {
  workspaceId: string;
  actorUserId: string;
  requestId: string;
  request: AiGenerateRequest;
};

export async function executeAiGeneration(input: ExecuteAiInput) {
  const document = input.request.documentId
    ? await getDocument(input.request.documentId, input.workspaceId)
    : null;
  if (input.request.documentId && !document) {
    throw new Error("Document not found");
  }

  const resolvedTemplateId =
    input.request.templateId ?? (document?.template_id ? document.template_id : undefined);
  const template = resolvedTemplateId ? await getTemplate(resolvedTemplateId, input.workspaceId) : null;
  if (resolvedTemplateId && !template) {
    throw new Error("Template not found");
  }

  const variableRegistry = (template?.variable_registry ?? {}) as VariableRegistry;
  const variableContext = ((document?.variables_json ?? {}) as VariableContext) ?? {};
  const variableOutput = resolveTemplateVariables(variableRegistry, variableContext);
  const pricing = ((document?.pricing_json ?? template?.pricing_json ?? null) as PricingModel | null) ?? null;

  const context: AiPromptContext = {
    documentId: document?.id ?? null,
    templateId: template?.id ?? null,
    documentStatus: document?.status ?? null,
    editorJson: (document?.editor_json ?? template?.editor_json ?? null) ?? null,
    variableRegistry: template?.variable_registry ?? null,
    variableContext: document?.variables_json ?? null,
    resolvedVariables: variableOutput.resolved,
    missingVariables: variableOutput.missing,
    pricing,
  };

  const prompts = buildAiPrompts({
    request: input.request,
    context,
  });
  const promptHash = sha256(`${prompts.systemPrompt}\n\n${prompts.userPrompt}`);

  if (document?.id) {
    await prisma.documentActivityEvent.create({
      data: {
        workspace_id: input.workspaceId,
        document_id: document.id,
        actor_user_id: input.actorUserId,
        event_type: "AI_ACTION_REQUESTED",
        metadata_json: {
          requestId: input.requestId,
          task: input.request.task,
          promptHash,
          stream: Boolean(input.request.stream),
          templateId: template?.id ?? null,
        },
      },
    });
  }

  try {
    const provider = new OpenAiCompatibleProvider();
    const result = await provider.generateText({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      maxOutputTokens: input.request.maxOutputTokens ?? 900,
      stream: Boolean(input.request.stream),
    });
    const outputHash = sha256(result.output);

    if (document?.id) {
      await prisma.documentActivityEvent.create({
        data: {
          workspace_id: input.workspaceId,
          document_id: document.id,
          actor_user_id: input.actorUserId,
          event_type: "AI_ACTION_COMPLETED",
          metadata_json: {
            requestId: input.requestId,
            task: input.request.task,
            templateId: template?.id ?? null,
            provider: result.provider,
            model: result.model,
            promptHash,
            outputHash,
            missingVariables: variableOutput.missing,
          },
        },
      });
    }

    return {
      task: input.request.task,
      output: result.output,
      provider: result.provider,
      model: result.model,
      promptHash,
      outputHash,
      context: {
        documentId: document?.id ?? null,
        templateId: template?.id ?? null,
        missingVariables: variableOutput.missing,
      },
      streaming: {
        requested: Boolean(input.request.stream),
        supported: result.supportsStreaming,
      },
    };
  } catch (error) {
    if (document?.id) {
      await prisma.documentActivityEvent.create({
        data: {
          workspace_id: input.workspaceId,
          document_id: document.id,
          actor_user_id: input.actorUserId,
          event_type: "AI_ACTION_FAILED",
          metadata_json: {
            requestId: input.requestId,
            task: input.request.task,
            templateId: template?.id ?? null,
            promptHash,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });
    }
    throw error;
  }
}
