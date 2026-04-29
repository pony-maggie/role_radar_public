import { GoogleGenAI } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z, type ZodTypeAny } from "zod";
import { getMiniMaxSettings } from "./minimax-client";
import type { StructuredGenerationResult } from "./provider-types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getGeminiSettings(env: NodeJS.ProcessEnv = process.env) {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || "",
    enabled: env.GEMINI_ENABLED !== "0",
    model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
  };
}

export type GeminiSettings = ReturnType<typeof getGeminiSettings>;
type ProviderGenerationResponse = {
  text: string;
  model: string;
};

type ProviderGenerateArgs = {
  prompt: string;
  schema: ZodTypeAny;
  systemInstruction?: string;
  env?: NodeJS.ProcessEnv;
  model: string;
};

type StructuredGenerationOverrides = {
  geminiGenerate?: (args: ProviderGenerateArgs) => Promise<string | ProviderGenerationResponse>;
  minimaxGenerate?: (args: ProviderGenerateArgs) => Promise<string | ProviderGenerationResponse>;
};

export function buildGeminiJsonConfig(schema: ZodTypeAny) {
  return {
    responseMimeType: "application/json" as const,
    responseJsonSchema: zodToJsonSchema(schema, {
      $refStrategy: "none"
    })
  };
}

export function createGeminiClient(env: NodeJS.ProcessEnv = process.env) {
  const settings = getGeminiSettings(env);
  if (!settings.apiKey) {
    throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY");
  }

  return {
    ai: new GoogleGenAI({
      apiKey: settings.apiKey
    }),
    enabled: settings.enabled,
    model: settings.model
  };
}

type StructuredGenerationParams<TSchema extends ZodTypeAny> = {
  prompt: string;
  schema: TSchema;
  systemInstruction?: string;
  env?: NodeJS.ProcessEnv;
  overrides?: StructuredGenerationOverrides;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    /"status":"UNAVAILABLE"/i.test(error.message) ||
    /"code":503/i.test(error.message) ||
    /"status":"RESOURCE_EXHAUSTED"/i.test(error.message) ||
    /"code":429/i.test(error.message)
  );
}

function isGeminiLocationUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    /FAILED_PRECONDITION/i.test(error.message) &&
    /location/i.test(error.message) &&
    /not supported/i.test(error.message)
  );
}

function normalizeProviderResponse(
  response: string | ProviderGenerationResponse,
  model: string
): ProviderGenerationResponse {
  if (typeof response === "string") {
    return {
      text: response,
      model
    };
  }

  return {
    text: response.text,
    model: response.model || model
  };
}

function unwrapStructuredResponseText(text: string) {
  let normalized = text.trim();

  normalized = normalized.replace(/^<think>[\s\S]*?<\/think>\s*/i, "").trim();

  const fencedMatch = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    normalized = fencedMatch[1].trim();
  }

  const objectStart = normalized.indexOf("{");
  const objectEnd = normalized.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return normalized.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = normalized.indexOf("[");
  const arrayEnd = normalized.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return normalized.slice(arrayStart, arrayEnd + 1);
  }

  return normalized;
}

function parseStructuredText<TSchema extends ZodTypeAny>(schema: TSchema, text: string, provider: string) {
  if (!text) {
    throw new Error(`${provider} returned an empty response`);
  }

  return schema.parse(JSON.parse(unwrapStructuredResponseText(text))) as z.infer<TSchema>;
}

function getMiniMaxErrorMessage(payload: {
  base_resp?: { status_code?: number; status_msg?: string };
} | null) {
  const statusCode = payload?.base_resp?.status_code;
  const statusMessage = payload?.base_resp?.status_msg?.trim();

  if (statusCode === 2049 || /invalid api key/i.test(statusMessage || "")) {
    return "MiniMax authentication failed: invalid api key";
  }

  return statusMessage || "MiniMax request failed";
}

async function generateWithGemini({
  prompt,
  schema,
  systemInstruction,
  env,
  overrides
}: StructuredGenerationParams<ZodTypeAny>) {
  const settings = getGeminiSettings(env);
  if (!settings.enabled) {
    throw new Error("Gemini disabled");
  }

  if (!settings.apiKey) {
    throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY");
  }

  if (overrides?.geminiGenerate) {
    return normalizeProviderResponse(
      await overrides.geminiGenerate({
        prompt,
        schema,
        systemInstruction,
        env,
        model: settings.model
      }),
      settings.model
    );
  }

  const client = createGeminiClient(env);
  let lastError: unknown;
  let response: Awaited<ReturnType<typeof client.ai.models.generateContent>> | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await client.ai.models.generateContent({
        model: client.model,
        contents: prompt,
        config: {
          ...buildGeminiJsonConfig(schema),
          ...(systemInstruction ? { systemInstruction } : {})
        }
      });
      break;
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === 2) {
        throw error;
      }

      await sleep(800 * (attempt + 1));
    }
  }

  if (!response) {
    throw lastError instanceof Error ? lastError : new Error("Gemini generation failed");
  }

  return {
    text: response.text ?? "",
    model: client.model
  };
}

async function generateWithMiniMax({
  prompt,
  schema,
  systemInstruction,
  env,
  overrides
}: StructuredGenerationParams<ZodTypeAny>) {
  const settings = getMiniMaxSettings(env);
  if (!settings.enabled) {
    throw new Error("MiniMax disabled");
  }

  if (!settings.apiKey) {
    throw new Error("Missing MINIMAX_API_KEY");
  }

  if (overrides?.minimaxGenerate) {
    return normalizeProviderResponse(
      await overrides.minimaxGenerate({
        prompt,
        schema,
        systemInstruction,
        env,
        model: settings.model
      }),
      settings.model
    );
  }

  const response = await fetch("https://api.minimaxi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        ...(systemInstruction
          ? [
              {
                role: "system",
                content: systemInstruction
              }
            ]
          : []),
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        base_resp?: { status_code?: number; status_msg?: string };
        choices?: Array<{ message?: { content?: string | null } | null }>;
        model?: string;
      }
    | null;

  if (!response.ok || (payload?.base_resp?.status_code ?? 0) !== 0) {
    const statusMessage = getMiniMaxErrorMessage(payload);
    if (/authentication failed/i.test(statusMessage)) {
      throw new Error(statusMessage);
    }

    throw new Error(
      `MiniMax request failed: ${
        response.ok ? statusMessage : response.statusText || statusMessage
      }`
    );
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("MiniMax returned an empty response");
  }

  return {
    text,
    model: payload?.model || settings.model
  };
}

function shouldFallbackToMiniMax(error: unknown, env: NodeJS.ProcessEnv = process.env) {
  const minimax = getMiniMaxSettings(env);
  if (!minimax.enabled || !minimax.apiKey) {
    return false;
  }

  const gemini = getGeminiSettings(env);
  if (!gemini.enabled || !gemini.apiKey) {
    return true;
  }

  return isGeminiLocationUnsupportedError(error) || isRetryableGeminiError(error);
}

export async function generateStructuredJson<TSchema extends ZodTypeAny>({
  prompt,
  schema,
  systemInstruction,
  env,
  overrides
}: StructuredGenerationParams<TSchema>): Promise<StructuredGenerationResult<z.infer<TSchema>>> {
  try {
    const gemini = await generateWithGemini({
      prompt,
      schema,
      systemInstruction,
      env,
      overrides
    });

    return {
      data: parseStructuredText(schema, gemini.text, "Gemini"),
      provider: "gemini",
      model: gemini.model
    };
  } catch (error) {
    if (!shouldFallbackToMiniMax(error, env)) {
      throw error;
    }

    const minimax = await generateWithMiniMax({
      prompt,
      schema,
      systemInstruction,
      env,
      overrides
    });

    return {
      data: parseStructuredText(schema, minimax.text, "MiniMax"),
      provider: "minimax",
      model: minimax.model
    };
  }
}
