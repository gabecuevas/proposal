import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { OpenAiCompatibleProvider } from "@/lib/ai/providers/openai-compatible";

export async function POST(request: NextRequest) {
  try {
    await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as {
      subject?: string;
      recipientName?: string;
      companyName?: string;
      tone?: string;
      notes?: string;
    } | null;

    const recipient = body?.recipientName?.trim() || "there";
    const company = body?.companyName?.trim();
    const subject = body?.subject?.trim();
    const notes = body?.notes?.trim();

    try {
      const provider = new OpenAiCompatibleProvider();
      const result = await provider.generateText({
        systemPrompt:
          "You write concise, professional CRM emails. Return only the email body as simple HTML using <p> tags. No subject line.",
        userPrompt: [
          `Write an email to ${recipient}${company ? ` at ${company}` : ""}.`,
          subject ? `Subject context: ${subject}` : "",
          notes ? `Extra context: ${notes}` : "",
          "Keep it under 160 words, friendly and clear, with a short call to action.",
        ]
          .filter(Boolean)
          .join("\n"),
        maxOutputTokens: 600,
        stream: false,
      });
      return jsonWithRequestId(request, { html: result.output });
    } catch {
      const html = [
        `<p>Hi ${recipient},</p>`,
        `<p>${
          notes
            ? notes
            : subject
              ? `I wanted to follow up regarding ${subject}.`
              : "I hope you’re doing well — I wanted to reach out quickly."
        }</p>`,
        company ? `<p>Looking forward to connecting with the team at ${company}.</p>` : "",
        `<p>Best regards</p>`,
      ]
        .filter(Boolean)
        .join("");
      return jsonWithRequestId(request, { html, fallback: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not draft email";
    return jsonWithRequestId(request, { error: message }, { status: 500 });
  }
}
