export type AiProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  stream: boolean;
};

export type AiProviderResponse = {
  output: string;
  provider: string;
  model: string;
  supportsStreaming: boolean;
};

export interface AiProvider {
  generateText(input: AiProviderRequest): Promise<AiProviderResponse>;
}
