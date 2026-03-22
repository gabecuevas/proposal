import type { AiProvider, AiProviderRequest, AiProviderResponse } from "../provider";

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

function getAiConfig() {
  const provider = process.env.AI_PROVIDER ?? "openai-compatible";
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";
  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured");
  }
  return { provider, apiKey, baseUrl, model };
}

function extractContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const textPart = item as { type?: string; text?: string };
      return textPart.type === "text" && typeof textPart.text === "string" ? textPart.text : "";
    })
    .join("")
    .trim();
}

export class OpenAiCompatibleProvider implements AiProvider {
  async generateText(input: AiProviderRequest): Promise<AiProviderResponse> {
    if (input.stream) {
      throw new Error("Streaming is not enabled yet for AI provider");
    }

    const config = getAiConfig();
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        max_tokens: input.maxOutputTokens,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI provider request failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const payload = (await response.json()) as ChatCompletionsResponse;
    const output = extractContent(payload.choices?.[0]?.message?.content);
    if (!output) {
      throw new Error("AI provider returned empty output");
    }

    return {
      output,
      provider: config.provider,
      model: config.model,
      supportsStreaming: false,
    };
  }
}
