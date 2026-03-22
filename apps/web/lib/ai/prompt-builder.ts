import type { AiGenerateRequest, AiTask } from "@repo/shared";
import type { JSONValue, PricingModel } from "@/lib/editor/types";
import { calculateQuoteTotals } from "@/lib/editor/quote";

export type AiPromptContext = {
  documentId: string | null;
  templateId: string | null;
  documentStatus: string | null;
  editorJson: JSONValue | null;
  variableRegistry: JSONValue | null;
  variableContext: JSONValue | null;
  resolvedVariables: Record<string, JSONValue>;
  missingVariables: string[];
  pricing: PricingModel | null;
};

function taskInstruction(task: AiTask): string {
  switch (task) {
    case "content_generation":
      return "Generate proposal/contract content aligned with the supplied template/document context.";
    case "section_rewrite":
      return "Rewrite the target section while preserving legal/commercial meaning and factual consistency.";
    case "document_summary":
      return "Summarize the document for business stakeholders with key obligations, risks, and next actions.";
    case "pricing_narrative":
      return "Generate a concise pricing narrative grounded in the pricing model and totals.";
    case "clause_suggestions":
      return "Suggest clauses and alternatives appropriate for this agreement context.";
    case "rfp_answer_draft":
      return "Draft clear RFP responses grounded in document/template context and variables.";
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildAiPrompts(input: {
  request: AiGenerateRequest;
  context: AiPromptContext;
}): { systemPrompt: string; userPrompt: string } {
  const pricingTotals = input.context.pricing ? calculateQuoteTotals(input.context.pricing) : null;
  const systemPrompt = [
    "You are an enterprise document copilot for proposals and contracts.",
    "Use only the provided structured context.",
    "Do not invent variables, terms, pricing, or signer requirements.",
    "If critical information is missing, explicitly call it out.",
    "Return concise, production-ready output in markdown.",
  ].join("\n");

  const userPrompt = [
    `Task: ${input.request.task}`,
    `Instruction: ${taskInstruction(input.request.task)}`,
    `User prompt: ${input.request.prompt}`,
    `Tone: ${input.request.tone ?? "default"}`,
    `Persona: ${input.request.persona ?? "default"}`,
    `Section title: ${input.request.sectionTitle ?? "n/a"}`,
    "",
    "Context:",
    stringify({
      documentId: input.context.documentId,
      templateId: input.context.templateId,
      documentStatus: input.context.documentStatus,
      resolvedVariables: input.context.resolvedVariables,
      missingVariables: input.context.missingVariables,
      variableContext: input.context.variableContext,
      variableRegistry: input.context.variableRegistry,
      pricing: input.context.pricing,
      pricingTotals,
      editorJson: input.context.editorJson,
    }),
  ].join("\n");

  return { systemPrompt, userPrompt };
}
