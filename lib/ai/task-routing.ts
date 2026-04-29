import type { ZodTypeAny } from "zod";
import { generateStructuredJson, getGeminiSettings } from "@/lib/ai/gemini-client";
import { getMiniMaxSettings } from "@/lib/ai/minimax-client";

type StructuredJsonArgs<TSchema extends ZodTypeAny> = Parameters<typeof generateStructuredJson<TSchema>>[0];

export type AiTaskRoute =
  | "source_classification"
  | "risk_scoring"
  | "role_discovery_adjudication";

type GenerateStructuredJsonForTaskArgs<TSchema extends ZodTypeAny> = Omit<
  StructuredJsonArgs<TSchema>,
  "env"
> & {
  task: AiTaskRoute;
  env?: NodeJS.ProcessEnv;
  structuredJsonGenerator?: typeof generateStructuredJson;
};

function getPreferredProviderOrder(task: AiTaskRoute) {
  switch (task) {
    case "role_discovery_adjudication":
      return ["minimax", "gemini"] as const;
    case "source_classification":
    case "risk_scoring":
    default:
      return ["gemini", "minimax"] as const;
  }
}

function canUseProvider(provider: "gemini" | "minimax", env: NodeJS.ProcessEnv) {
  if (provider === "gemini") {
    const settings = getGeminiSettings(env);
    return settings.enabled && Boolean(settings.apiKey);
  }

  const settings = getMiniMaxSettings(env);
  return settings.enabled && Boolean(settings.apiKey);
}

function buildProviderPinnedEnv(provider: "gemini" | "minimax", env: NodeJS.ProcessEnv) {
  return {
    ...env,
    GEMINI_ENABLED: provider === "gemini" ? env.GEMINI_ENABLED ?? "1" : "0",
    MINIMAX_ENABLED: provider === "minimax" ? env.MINIMAX_ENABLED ?? "1" : "0"
  };
}

export async function generateStructuredJsonForTask<TSchema extends ZodTypeAny>({
  task,
  env = process.env,
  structuredJsonGenerator = generateStructuredJson,
  ...rest
}: GenerateStructuredJsonForTaskArgs<TSchema>) {
  const providers = getPreferredProviderOrder(task).filter((provider) => canUseProvider(provider, env));
  if (providers.length === 0) {
    return structuredJsonGenerator({
      ...rest,
      env
    });
  }

  let lastError: unknown;

  for (const provider of providers) {
    try {
      return await structuredJsonGenerator({
        ...rest,
        env: buildProviderPinnedEnv(provider, env)
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to generate structured JSON for task: ${task}`);
}
