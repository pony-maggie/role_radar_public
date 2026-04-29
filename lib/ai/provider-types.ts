export type StructuredGenerationProvider = "gemini" | "minimax";

export type ProviderSettings = {
  apiKey: string;
  enabled: boolean;
  model: string;
};

export type StructuredGenerationResult<T> = {
  data: T;
  provider: StructuredGenerationProvider;
  model: string;
};
