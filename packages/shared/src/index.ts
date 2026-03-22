import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const documentLifecycleSchema = z.enum([
  "DRAFTED",
  "SENT",
  "VIEWED",
  "COMMENTED",
  "SIGNED",
  "PAID",
  "EXPIRED",
  "VOID",
]);

export type DocumentLifecycle = z.infer<typeof documentLifecycleSchema>;

export type PdfFinalizationJobPayload = {
  documentId: string;
  workspaceId: string;
  correlationId?: string;
  html: string;
  docHash: string;
  pdfKey: string;
  certificate: {
    finalizedAt: string;
    actorUserId?: string;
    actorRecipientId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  generatedAt: string;
};

export type WebhookDeliveryJobPayload = {
  deliveryId: string;
  correlationId?: string;
};

export const aiTaskSchema = z.enum([
  "content_generation",
  "section_rewrite",
  "document_summary",
  "pricing_narrative",
  "clause_suggestions",
  "rfp_answer_draft",
]);

export type AiTask = z.infer<typeof aiTaskSchema>;

export const aiGenerateRequestSchema = z.object({
  task: aiTaskSchema,
  documentId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  prompt: z.string().min(1).max(12_000),
  tone: z.string().min(1).max(120).optional(),
  persona: z.string().min(1).max(120).optional(),
  sectionTitle: z.string().min(1).max(240).optional(),
  maxOutputTokens: z.number().int().min(128).max(4096).optional(),
  stream: z.boolean().optional(),
});

export type AiGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;

export const aiGenerateResponseSchema = z.object({
  result: z.object({
    task: aiTaskSchema,
    output: z.string(),
    provider: z.string(),
    model: z.string(),
    promptHash: z.string(),
    outputHash: z.string(),
    context: z.object({
      documentId: z.string().nullable(),
      templateId: z.string().nullable(),
      missingVariables: z.array(z.string()),
    }),
    streaming: z.object({
      requested: z.boolean(),
      supported: z.boolean(),
    }),
  }),
});

export type AiGenerateResponse = z.infer<typeof aiGenerateResponseSchema>;
