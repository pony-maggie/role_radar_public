import { z } from "zod";

export const roleRiskReasonSchema = z.object({
  kind: z.enum(["structure", "official", "media", "jobs"]),
  titleEn: z.string().min(1),
  titleZh: z.string().min(1).nullable().optional(),
  detailEn: z.string().min(1),
  detailZh: z.string().min(1).nullable().optional()
});

export const sourceItemClassificationSchema = z.object({
  assignedRoleSlug: z.string().min(1).nullable(),
  sourceKind: z.enum(["official", "media", "jobs", "other"]),
  signalType: z.enum([
    "capability_update",
    "adoption_case",
    "workflow_restructure",
    "hiring_shift",
    "ecosystem_context"
  ]),
  relevance: z.enum(["high", "medium", "low", "none"]),
  impactDirection: z.enum(["increase", "decrease", "neutral"]),
  explanation: z.string().min(1),
  summaryEn: z.string().min(1),
  summaryZh: z.string().min(1).nullable().optional(),
  signalWeight: z.enum(["primary", "secondary", "supporting"])
});

export const roleRiskInferenceSchema = z.object({
  replacementRate: z.number().int().min(0).max(100),
  riskBand: z.enum(["low", "medium", "high", "severe"]),
  summaryEn: z.string().min(1),
  summaryZh: z.string().min(1).nullable().optional(),
  reasons: z.array(roleRiskReasonSchema).min(1).max(5)
});

export type SourceItemClassification = z.infer<typeof sourceItemClassificationSchema>;
export type RoleRiskInference = z.infer<typeof roleRiskInferenceSchema>;
export type RoleRiskReason = z.infer<typeof roleRiskReasonSchema>;
