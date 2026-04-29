import type {
  RatingStatus as PrismaRatingStatus,
  RiskLevel as PrismaRiskLevel,
  SignalStrength as PrismaSignalStrength
} from "@prisma/client";

export type RiskLevel = PrismaRiskLevel;
export type RatingStatus = PrismaRatingStatus;
export type SignalStrength = PrismaSignalStrength;
export type RiskTrend = "STABLE" | "RISING" | "COOLING";

export type RatedRiskResult = {
  status: "RATED";
  level: RiskLevel;
  trend: RiskTrend;
};

export type InsufficientSignalRiskResult = {
  status: "INSUFFICIENT_SIGNAL";
  persistedLevel: "LOW";
  trend: "STABLE";
};

export type RiskResult = RatedRiskResult | InsufficientSignalRiskResult;

export type StructuralFactors = {
  repetitionScore: number;
  ruleClarityScore: number;
  transformationScore: number;
  workflowAutomationScore: number;
  interpersonalScore: number;
  physicalityScore: number;
  ambiguityScore: number;
};

export type RiskInput = {
  structural: StructuralFactors;
  signals: Array<{ strength: SignalStrength; publishedAt: Date }>;
};
