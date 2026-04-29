import type { ProviderSettings } from "./provider-types";

export const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7";

export function getMiniMaxSettings(env: NodeJS.ProcessEnv = process.env): ProviderSettings {
  return {
    apiKey: env.MINIMAX_API_KEY?.trim() || "",
    enabled: env.MINIMAX_ENABLED !== "0",
    model: env.MINIMAX_MODEL?.trim() || DEFAULT_MINIMAX_MODEL
  };
}
