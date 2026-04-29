import { describe, expect, it } from "vitest";
import { inferRoleCandidates } from "@/lib/ingest/infer-role-candidates";

describe("inferRoleCandidates", () => {
  it("finds a high-confidence unique customer support match", () => {
    const result = inferRoleCandidates({
      title: "AI triage helps customer support teams deflect ticket volume",
      summary: "Support agents and help desk operators are automating ticket routing."
    });

    expect(result.uniqueCandidate).toMatchObject({
      roleSlug: "customer-service-representative",
      confidence: "high"
    });
    expect(result.candidates[0]?.matchedKeywords).toEqual(
      expect.arrayContaining(["customer support", "help desk", "ticket"])
    );
  });

  it("finds a high-confidence unique bookkeeping match", () => {
    const result = inferRoleCandidates({
      title: "Bookkeeping copilots automate reconciliation and invoice checks",
      summary: "Teams reduce ledger review work with accounting workflow automation."
    });

    expect(result.uniqueCandidate).toMatchObject({
      roleSlug: "bookkeeping-clerk",
      confidence: "high"
    });
    expect(result.candidates[0]?.matchedKeywords).toEqual(
      expect.arrayContaining(["bookkeeping", "reconciliation", "invoice", "ledger"])
    );
  });

  it("does not produce a unique confident match for ambiguous workflow language", () => {
    const result = inferRoleCandidates({
      title: "AI workflow tools spread across operations teams",
      summary: "General automation interest rises, but the role impact is unclear."
    });

    expect(result.uniqueCandidate).toBeNull();
    expect(result.candidates.every((candidate) => candidate.confidence !== "high")).toBe(true);
  });
});
