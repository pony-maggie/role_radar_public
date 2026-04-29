import { refreshRoleRisk } from "@/lib/repositories/risk-refresh";

export async function refreshRoleRiskUseCase(roleSlug: string) {
  return refreshRoleRisk(roleSlug);
}
