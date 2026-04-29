import { describe, expect, it, vi } from "vitest";
import { fetchJobsItems } from "@/lib/ingest/fetch-jobs";

const openAiCareersSource = {
  id: "jobs-openai-careers",
  label: "OpenAI Careers",
  class: "jobs",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "en",
  url: "https://openai.com/jobs/",
  mappingMode: "direct_mapped",
  roleSlug: "bookkeeping-clerk",
  sourceType: "JOB_POSTING"
} as const;

const anthropicCareersSource = {
  id: "jobs-anthropic-careers",
  label: "Anthropic Careers",
  class: "jobs",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "en",
  url: "https://www.anthropic.com/careers",
  mappingMode: "direct_mapped",
  roleSlug: "industrial-maintenance-technician",
  sourceType: "JOB_POSTING"
} as const;

describe("fetchJobsItems", () => {
  it("propagates source topic hints into parsed job items", async () => {
    const hintedSource = {
      ...openAiCareersSource,
      topicHints: ["finance ops", "workflow automation"]
    } as const;
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article class="job-card">
              <a href="/jobs/senior-support-ops">
                <h2>Senior Support Operations Specialist</h2>
              </a>
              <p class="meta">Team: Support Operations</p>
              <p class="meta">Location: San Francisco, CA</p>
              <time datetime="2026-04-11T00:00:00Z">April 11, 2026</time>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchJobsItems(hintedSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.topicHints).toEqual(["finance ops", "workflow automation"]);
  });

  it("parses openai careers job cards into raw source items", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article class="job-card">
              <a href="/jobs/senior-support-ops">
                <h2>Senior Support Operations Specialist</h2>
              </a>
              <p class="meta">Team: Support Operations</p>
              <p class="meta">Location: San Francisco, CA</p>
              <time datetime="2026-04-11T00:00:00Z">April 11, 2026</time>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchJobsItems(openAiCareersSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://openai.com/jobs/senior-support-ops",
      title: "Senior Support Operations Specialist",
      publishedAt: "2026-04-11T00:00:00Z",
      summary: "Support Operations • San Francisco, CA • April 11, 2026",
      sourceType: "JOB_POSTING",
      sourceLabel: "OpenAI Careers",
      sourceCatalogId: "jobs-openai-careers",
      roleSlug: "bookkeeping-clerk"
    });
  });

  it("parses anthropic careers listings with relative links and team metadata", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <ul>
              <li class="listing-card">
                <a href="/careers/research-engineer">
                  <h3>Research Engineer, Applied AI</h3>
                </a>
                <div class="listing-meta">Department: Research</div>
                <div class="listing-meta">Location: New York, NY</div>
                <time datetime="2026-04-09T12:00:00Z">April 9, 2026</time>
              </li>
            </ul>
          </body>
        </html>
      `
    });

    const items = await fetchJobsItems(anthropicCareersSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.anthropic.com/careers/research-engineer",
      title: "Research Engineer, Applied AI",
      summary: "Research • New York, NY • April 9, 2026",
      sourceType: "JOB_POSTING",
      sourceLabel: "Anthropic Careers",
      sourceCatalogId: "jobs-anthropic-careers",
      roleSlug: "industrial-maintenance-technician"
    });
  });

  it("routes jobs-class html sources through the jobs parser", async () => {
    vi.resetModules();

    const jobsModule = await import("@/lib/ingest/fetch-jobs");
    const fetchJobsSpy = vi.spyOn(jobsModule, "fetchJobsItems").mockResolvedValue([]);
    const { fetchCatalogSourceItems } = await import("@/lib/ingest/source-loader");

    const items = await fetchCatalogSourceItems(openAiCareersSource);

    expect(fetchJobsSpy).toHaveBeenCalledWith(openAiCareersSource);
    expect(items).toEqual([]);
  });

  it("reads metadata from data attributes when jobs pages expose structured cards", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article class="job-card" data-team="Applied AI" data-location="Remote" data-department="Research">
              <a href="/jobs/applied-ai-researcher">
                <h2>Applied AI Researcher</h2>
              </a>
              <time datetime="2026-04-12T00:00:00Z">April 12, 2026</time>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchJobsItems(openAiCareersSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe("Applied AI • Research • Remote • April 12, 2026");
  });
});
