import attributionFixtures from "@/data/regression/source-item-attribution-regression.json";
import roleRiskFixtures from "@/data/regression/role-risk-regression.json";
import { classifySourceItem } from "@/lib/ai/classify-source-item";
import { prisma } from "@/lib/db/prisma";
import { scoreRoleRisk } from "@/lib/ai/score-role-risk";

type AttributionFixture = (typeof attributionFixtures)[number];
type RoleRiskFixture = (typeof roleRiskFixtures)[number];

function inferFixtureSignalType(item: {
  sourceType: string;
  impactDirection: string;
  signalType?: string;
}) {
  if (item.signalType) return item.signalType;
  if (item.sourceType === "jobs" || item.sourceType === "JOB_POSTING") return "HIRING_SHIFT";
  if (item.impactDirection === "neutral") return "TOOLING";
  return "ADOPTION";
}

async function loadRoleDictionary() {
  const roles = await prisma.roleDictionary.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      nameEn: true,
      nameZh: true,
      keywords: true
    }
  });

  return roles.map((role) => ({
    slug: role.slug,
    nameEn: role.nameEn,
    nameZh: role.nameZh,
    keywords: Array.isArray(role.keywords) ? role.keywords.filter((value): value is string => typeof value === "string") : []
  }));
}

async function runAttributionRegression(fixtures: AttributionFixture[]) {
  const roles = await loadRoleDictionary();
  let passed = 0;

  for (const fixture of fixtures) {
    const result = await classifySourceItem(
      {
        sourceLabel: fixture.sourceLabel,
        sourceType: fixture.sourceType,
        title: fixture.title,
        summary: fixture.summary
      },
      roles
    );

    const actual = result.assignedRoleSlug;
    const ok = actual === fixture.expectedAssignedRoleSlug;
    passed += ok ? 1 : 0;

    console.log(
      `[attr] ${ok ? "PASS" : "FAIL"} ${fixture.id} expected=${fixture.expectedAssignedRoleSlug ?? "null"} actual=${
        actual ?? "null"
      }`
    );
  }

  console.log(`[attr] summary ${passed}/${fixtures.length} passed`);
  return passed === fixtures.length;
}

async function runRoleRiskRegression(fixtures: RoleRiskFixture[]) {
  let passed = 0;

  for (const fixture of fixtures) {
    const role = await prisma.role.findUnique({
      where: { slug: fixture.roleSlug },
      select: {
        nameEn: true,
        nameZh: true,
        summaryEn: true,
        summaryZh: true,
        repetitionScore: true,
        ruleClarityScore: true,
        transformationScore: true,
        workflowAutomationScore: true,
        interpersonalScore: true,
        physicalityScore: true,
        ambiguityScore: true
      }
    });

    if (!role) {
      throw new Error(`Unknown role slug in role-risk regression: ${fixture.roleSlug}`);
    }

    const result = await scoreRoleRisk(
      role,
      fixture.items.map((item) => ({
        ...item,
        signalType: inferFixtureSignalType(item)
      }))
    );
    const inRange =
      result.data.replacementRate >= fixture.expectedReplacementRateMin &&
      result.data.replacementRate <= fixture.expectedReplacementRateMax;
    const bandOk = result.data.riskBand === fixture.expectedRiskBand;
    const ok = inRange && bandOk;
    passed += ok ? 1 : 0;

    console.log(
      `[risk] ${ok ? "PASS" : "FAIL"} ${fixture.id} rate=${result.data.replacementRate} expected=${fixture.expectedReplacementRateMin}-${fixture.expectedReplacementRateMax} band=${result.data.riskBand}/${fixture.expectedRiskBand}`
    );
  }

  console.log(`[risk] summary ${passed}/${fixtures.length} passed`);
  return passed === fixtures.length;
}

async function main() {
  const attributionOk = await runAttributionRegression(attributionFixtures);
  const riskOk = await runRoleRiskRegression(roleRiskFixtures);
  await prisma.$disconnect();

  if (!attributionOk || !riskOk) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  if (
    error instanceof Error &&
    /location is not supported for the api use/i.test(error.message)
  ) {
    console.error(
      "Gemini regression runner failed because the current network location is not supported by the Gemini API. The code path is in place, but live regression must be run from a supported region."
    );
  } else if (error instanceof Error && /"status":"UNAVAILABLE"/i.test(error.message)) {
    console.error(
      "Gemini regression runner failed because the selected Gemini model is temporarily unavailable under current demand. Retry later or switch GEMINI_MODEL to another supported Gemini model."
    );
  } else if (error instanceof Error && /MiniMax authentication failed: invalid api key/i.test(error.message)) {
    console.error(
      "MiniMax regression runner failed because MINIMAX_API_KEY is invalid. Update MINIMAX_API_KEY and retry."
    );
  } else {
    console.error(error);
  }
  await prisma.$disconnect();
  process.exit(1);
});
