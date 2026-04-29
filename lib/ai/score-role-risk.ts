import { generateStructuredJson } from "./gemini-client";
import { roleRiskInferenceSchema, type RoleRiskInference } from "./gemini-schemas";
import { buildRoleRiskPrompt } from "./prompts/score-role-risk";
import type { StructuredGenerationResult } from "./provider-types";
import { generateStructuredJsonForTask } from "./task-routing";

type RoleContext = Parameters<typeof buildRoleRiskPrompt>[0]["role"];
type ClassifiedSourceContext = Parameters<typeof buildRoleRiskPrompt>[0]["items"][number];

export async function scoreRoleRisk(
  role: RoleContext,
  items: ClassifiedSourceContext[],
  structuredJsonGenerator: typeof generateStructuredJson = generateStructuredJson
): Promise<StructuredGenerationResult<RoleRiskInference>> {
  const prompt = buildRoleRiskPrompt({
    role,
    items
  });

  const generatorArgs = {
    prompt,
    schema: roleRiskInferenceSchema,
    systemInstruction:
      "Return only structured JSON. Score the role directly for today using both the role profile and the recent evidence. Keep the percentage bounded, stable under sparse evidence, and evidence-aware in the reasons."
  } as const;

  const generation =
    structuredJsonGenerator === generateStructuredJson
      ? await generateStructuredJsonForTask({
          task: "risk_scoring",
          ...generatorArgs
        })
      : await structuredJsonGenerator(generatorArgs);

  return {
    ...generation,
    data: roleRiskInferenceSchema.parse(generation.data)
  };
}
