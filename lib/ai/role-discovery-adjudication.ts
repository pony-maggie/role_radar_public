import { z } from "zod";
import { generateStructuredJson, getGeminiSettings } from "@/lib/ai/gemini-client";
import { getMiniMaxSettings } from "@/lib/ai/minimax-client";
import type { StructuredGenerationResult } from "@/lib/ai/provider-types";
import { buildRoleDiscoveryAdjudicationPrompt } from "@/lib/ai/prompts/role-discovery-adjudication";
import { generateStructuredJsonForTask } from "@/lib/ai/task-routing";

const roleDiscoveryAdjudicationSchema = z.object({
  accepted: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1)
});

type RoleDiscoveryInput = {
  role: {
    slug: string;
    nameEn: string;
    nameZh: string;
    aliases: string[];
    tasks: string[];
  };
  candidate: {
    url: string;
    title: string;
    snippet: string;
    publishedAt?: string | null;
  };
};

type RoleDiscoveryAdjudication = StructuredGenerationResult<
  z.infer<typeof roleDiscoveryAdjudicationSchema>
>;

type AdjudicationOptions = {
  env?: NodeJS.ProcessEnv;
  structuredJsonGenerator?: typeof generateStructuredJson;
};

async function generateRoleDiscoveryAdjudication(
  prompt: string,
  options: AdjudicationOptions
): Promise<RoleDiscoveryAdjudication | null> {
  const env = options.env ?? process.env;
  const structuredJsonGenerator = options.structuredJsonGenerator ?? generateStructuredJson;
  const minimax = getMiniMaxSettings(env);
  const gemini = getGeminiSettings(env);
  if ((minimax.enabled && minimax.apiKey) || (gemini.enabled && gemini.apiKey)) {
    return generateStructuredJsonForTask({
      task: "role_discovery_adjudication",
      prompt,
      schema: roleDiscoveryAdjudicationSchema,
      systemInstruction:
        "Return only structured JSON. Be conservative. Accept only if the hit concretely describes AI-affected workflows, tasks, or role-adjacent job activity for the target occupation.",
      env,
      structuredJsonGenerator
    });
  }

  return null;
}

export async function adjudicateRoleDiscoveryCandidate(
  input: RoleDiscoveryInput,
  options: AdjudicationOptions = {}
) {
  const prompt = buildRoleDiscoveryAdjudicationPrompt(input);
  const generation = await generateRoleDiscoveryAdjudication(prompt, options);

  if (!generation) {
    return null;
  }

  return {
    accepted: generation.data.accepted,
    confidence: generation.data.confidence,
    reason: generation.data.reason,
    provider: generation.provider,
    model: generation.model
  };
}
