import { describe, expect, it, vi } from "vitest";
import { fetchHtmlItems } from "@/lib/ingest/fetch-html";

const anthropicSource = {
  id: "official-anthropic-news",
  label: "Anthropic News",
  class: "official",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "en",
  url: "https://www.anthropic.com/news",
  mappingMode: "direct_mapped",
  roleSlug: "customer-service-representative",
  sourceType: "COMPANY_UPDATE"
} as const;

const aiBaseSource = {
  id: "media-aibase-ai",
  label: "AIbase",
  class: "media",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "zh",
  url: "https://www.aibase.com/news/",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const microsoftSource = {
  id: "official-microsoft-ai",
  label: "Microsoft Source AI",
  class: "official",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "en",
  url: "https://news.microsoft.com/source/topics/ai/",
  mappingMode: "observe_only",
  sourceType: "COMPANY_UPDATE"
} as const;

const decoderSource = {
  id: "media-the-decoder-ai",
  label: "The Decoder",
  class: "media",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: true,
  locale: "en",
  url: "https://the-decoder.com/",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const infoqSource = {
  id: "media-infoq-ai-ml",
  label: "InfoQ AI/ML/Data Engineering",
  class: "media",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: true,
  locale: "en",
  url: "https://www.infoq.com/ai-ml-data-eng/",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const jiqizhixinSource = {
  id: "media-jiqizhixin-ai",
  label: "机器之心",
  class: "media",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: true,
  locale: "zh",
  url: "https://www.jiqizhixin.com/",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const qbitaiSource = {
  id: "media-qbitai-ai",
  label: "量子位",
  class: "media",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: true,
  locale: "zh",
  url: "https://www.qbitai.com/",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const mistralSource = {
  id: "official-mistral-news",
  label: "Mistral AI News",
  class: "official",
  transport: "html",
  tier: "manual_html",
  enabledByDefault: false,
  locale: "en",
  url: "https://mistral.ai/news",
  mappingMode: "observe_only",
  sourceType: "COMPANY_UPDATE"
} as const;

describe("fetchHtmlItems", () => {
  it("propagates source topic hints into parsed html items", async () => {
    const hintedSource = {
      ...anthropicSource,
      topicHints: ["workflow automation", "customer support"]
    } as const;
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article>
              <a href="/news/support-workflows">
                <h2>Anthropic expands support workflow tooling</h2>
              </a>
              <time datetime="2026-04-10T00:00:00Z">April 10, 2026</time>
              <p>New workflow automation guidance for support teams.</p>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(hintedSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.topicHints).toEqual(["workflow automation", "customer support"]);
  });

  it("parses english article cards from a maintained manual source", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article>
              <a href="/news/support-workflows">
                <h2>Anthropic expands support workflow tooling</h2>
              </a>
              <time datetime="2026-04-10T00:00:00Z">April 10, 2026</time>
              <p>New workflow automation guidance for support teams.</p>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(anthropicSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.anthropic.com/news/support-workflows",
      title: "Anthropic expands support workflow tooling",
      summary: "New workflow automation guidance for support teams.",
      sourceType: "COMPANY_UPDATE",
      sourceLabel: "Anthropic News",
      sourceCatalogId: "official-anthropic-news",
      roleSlug: "customer-service-representative"
    });
    expect(items[0]?.publishedAt).toContain("2026-04-10");
  });

  it("parses chinese article cards and resolves relative links", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article>
              <a href="/news/20480">
                <h2>AIbase：智能客服案例正在加速落地</h2>
              </a>
              <time datetime="2026-04-09T08:00:00Z">2026-04-09</time>
              <p>多家企业开始把客服场景迁移到 AI 工作流。</p>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(aiBaseSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.aibase.com/news/20480",
      title: "AIbase：智能客服案例正在加速落地",
      summary: "多家企业开始把客服场景迁移到 AI 工作流。",
      sourceType: "NEWS",
      sourceLabel: "AIbase",
      sourceCatalogId: "media-aibase-ai"
    });
  });

  it("recovers The Decoder listing cards from nested teaser blocks", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <div class="feed-entry">
              <div class="feed-entry__content">
                <a href="/2026/04/11/ai-agents-reshape-back-office-work/">
                  <h3>AI agents are reshaping back-office work</h3>
                </a>
                <span class="feed-entry__date">April 11, 2026</span>
                <p>Enterprises are rolling out agentic tooling for recurring operations.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(decoderSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://the-decoder.com/2026/04/11/ai-agents-reshape-back-office-work/",
      title: "AI agents are reshaping back-office work",
      summary: "Enterprises are rolling out agentic tooling for recurring operations.",
      sourceType: "NEWS",
      sourceLabel: "The Decoder",
      sourceCatalogId: "media-the-decoder-ai"
    });
    expect(items[0]?.publishedAt).toContain("April 11, 2026");
  });

  it("recovers InfoQ listing cards with nested title and excerpt blocks", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <li class="article-item">
              <div class="article-item__content">
                <h2><a href="/articles/ai-data-eng-workflows/">AI data engineering workflows are changing</a></h2>
                <div class="article-item__date">Apr 12, 2026</div>
                <div class="article-item__description">
                  InfoQ explains how data teams are automating recurring preparation and review work.
                </div>
              </div>
            </li>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(infoqSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.infoq.com/articles/ai-data-eng-workflows/",
      title: "AI data engineering workflows are changing",
      summary: "InfoQ explains how data teams are automating recurring preparation and review work.",
      sourceType: "NEWS",
      sourceLabel: "InfoQ AI/ML/Data Engineering",
      sourceCatalogId: "media-infoq-ai-ml"
    });
  });

  it("does not invent a current timestamp for undated InfoQ cards", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <li class="article-item">
              <div class="article-item__content">
                <h2><a href="/articles/ai-data-eng-workflows/">AI data engineering workflows are changing</a></h2>
                <div class="article-item__description">
                  InfoQ explains how data teams are automating recurring preparation and review work.
                </div>
              </div>
            </li>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(infoqSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(0);
  });

  it("ignores promo chrome cards that resemble articles but are not article cards", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <div class="promo-card">
              <h2><a href="/promo/ai-data-eng-workflows/">Sponsored: AI data engineering workflows</a></h2>
              <div class="promo-card__date">Apr 12, 2026</div>
              <div class="promo-card__description">
                A promotional sidebar card about training and certification.
              </div>
            </div>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(infoqSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(0);
  });

  it("recovers 机器之心 cards with nested article metadata", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <div class="news-card">
              <a class="news-card__title" href="/news/2026-04-12-agentic-enterprise-ops">
                机器之心：企业工作流开始向 Agent 化迁移
              </a>
              <div class="news-card__meta">2026-04-12</div>
              <div class="news-card__summary">
                多个团队正在把审批、检索和客服任务迁移到 AI 工作流中。
              </div>
            </div>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(jiqizhixinSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.jiqizhixin.com/news/2026-04-12-agentic-enterprise-ops",
      title: "机器之心：企业工作流开始向 Agent 化迁移",
      summary: "多个团队正在把审批、检索和客服任务迁移到 AI 工作流中。",
      sourceType: "NEWS",
      sourceLabel: "机器之心",
      sourceCatalogId: "media-jiqizhixin-ai"
    });
  });

  it("recovers 量子位 cards with nested list item markup", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <section class="qbit-article">
              <h3 class="qbit-article__title">
                <a href="/2026/04/13/agentic-finance-teams/">量子位：Agent 正在进入财务团队</a>
              </h3>
              <span class="qbit-article__date">2026-04-13</span>
              <p class="qbit-article__summary">
                财务团队正在用 AI 自动化对账、复核和例行报告。
              </p>
            </section>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(qbitaiSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.qbitai.com/2026/04/13/agentic-finance-teams/",
      title: "量子位：Agent 正在进入财务团队",
      summary: "财务团队正在用 AI 自动化对账、复核和例行报告。",
      sourceType: "NEWS",
      sourceLabel: "量子位",
      sourceCatalogId: "media-qbitai-ai"
    });
  });

  it("recovers AIbase cards from embedded Next.js article payloads", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <script>
              self.__next_f.push([1,"[{\"Id\":20480,\"title\":\"AIbase：智能客服案例正在加速落地\",\"subtitle\":\"AIbase subtitle\",\"description\":\"多家企业开始把客服场景迁移到 AI 工作流。\",\"addtime\":\"2026-04-09 08:00:00\",\"url\":\"\",\"vurl\":\"\",\"summary\":\"$29\"},{\"Id\":20481,\"title\":\"AIbase sponsor card\",\"description\":\"Promotional sidebar content without a publish date.\",\"addtime\":\"\",\"url\":\"\",\"vurl\":\"\"}]"])
            </script>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(aiBaseSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://www.aibase.com/news/20480",
      title: "AIbase：智能客服案例正在加速落地",
      summary: "多家企业开始把客服场景迁移到 AI 工作流。",
      sourceType: "NEWS",
      sourceLabel: "AIbase",
      sourceCatalogId: "media-aibase-ai"
    });
  });

  it("captures card-style html listings from enabled manual media sources", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <div class="post-card">
              <h2 class="entry-title">
                <a href="/2026/04/11/ai-agents-reshape-back-office-work/">
                  AI agents are reshaping back-office work
                </a>
              </h2>
              <time datetime="2026-04-11T08:00:00Z">April 11, 2026</time>
              <p>Enterprises are rolling out agentic tooling for recurring operations.</p>
            </div>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(decoderSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://the-decoder.com/2026/04/11/ai-agents-reshape-back-office-work/",
      title: "AI agents are reshaping back-office work",
      summary: "Enterprises are rolling out agentic tooling for recurring operations.",
      sourceType: "NEWS",
      sourceLabel: "The Decoder",
      sourceCatalogId: "media-the-decoder-ai"
    });
    expect(items[0]?.publishedAt).toContain("2026-04-11");
  });

  it("prefers excerpt divs over metadata divs in card-style layouts", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <section class="post-card">
              <h2 class="entry-title">
                <a href="/2026/04/12/agent-rollouts-expand/">
                  Agent rollouts expand across enterprise operations
                </a>
              </h2>
              <div class="post-meta">April 12, 2026</div>
              <div class="post-excerpt">
                Enterprises are using AI agents to automate recurring finance and support work.
              </div>
            </section>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(decoderSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe(
      "Enterprises are using AI agents to automate recurring finance and support work."
    );
    expect(items[0]?.publishedAt).toContain("2026");
  });

  it("captures nested div excerpts inside div post-card wrappers", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <div class="post-card">
              <h2 class="entry-title">
                <a href="/2026/04/13/agentic-finance-teams/">
                  Agentic tooling spreads into finance teams
                </a>
              </h2>
              <div class="post-meta">April 13, 2026</div>
              <div class="post-excerpt">
                Finance teams are using AI agents to automate reconciliations and recurring reviews.
              </div>
            </div>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(decoderSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe(
      "Finance teams are using AI agents to automate reconciliations and recurring reviews."
    );
    expect(items[0]?.publishedAt).toContain("2026");
  });

  it("keeps unknown manual html sources disabled by design", async () => {
    const fetchFn = vi.fn();

    await expect(
      fetchHtmlItems(
        {
          id: "unknown-manual-source",
          label: "Unknown Manual Source",
          class: "media",
          transport: "html",
          tier: "manual_html",
          enabledByDefault: false,
          locale: "en",
          url: "https://example.com/",
          mappingMode: "observe_only",
          sourceType: "NEWS"
        },
        fetchFn as typeof fetch
      )
    ).rejects.toThrow("Unsupported HTML/manual source unknown-manual-source");
  });

  it("parses heading-link layouts used by official microsoft topic pages", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <section>
              <h2><a href="/source/features/ai-agents-work/">How AI agents are changing work</a></h2>
              <div>April 12, 2026</div>
              <p>Microsoft explains how AI agents are reshaping workplace workflows.</p>
            </section>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(microsoftSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://news.microsoft.com/source/features/ai-agents-work/",
      title: "How AI agents are changing work",
      summary: "Microsoft explains how AI agents are reshaping workplace workflows.",
      sourceType: "COMPANY_UPDATE",
      sourceLabel: "Microsoft Source AI",
      sourceCatalogId: "official-microsoft-ai"
    });
    expect(items[0]?.publishedAt).toContain("2026");
  });

  it("prioritizes microsoft article cards that are more likely to map to occupations", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <article>
              <a href="/source/features/innovation/healthcare-ai" class="featured-image">
                <img src="/hero.png" alt="" />
              </a>
              <h2 class="h2"><a href="/source/features/innovation/healthcare-ai">7 ways AI is advancing healthcare and wellbeing around the world</a></h2>
            </article>
            <article>
              <a href="/source/features/ai/copilot-work" class="featured-image">
                <img src="/copilot.png" alt="" />
              </a>
              <h2 class="h2"><a href="/source/features/ai/copilot-work">From prompts to partnership: How LTM's Rajesh Kumar collaborates with Microsoft 365 Copilot</a></h2>
            </article>
            <article>
              <a href="https://microsoft.ai/news/foundry-models" class="featured-image">
                <img src="/foundry.png" alt="" />
              </a>
              <h3 class="h3"><a href="https://microsoft.ai/news/foundry-models">3 new world-class MAI models now available in Foundry</a></h3>
            </article>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(microsoftSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(3);
    expect(items[0]?.title).toContain("Microsoft 365 Copilot");
    expect(items[1]?.title).toBe("3 new world-class MAI models now available in Foundry");
    expect(items[2]?.title).toContain("healthcare and wellbeing");
  });

  it("prioritizes workflow-relevant microsoft ai updates over broad ecosystem pieces", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <section>
              <h2><a href="/source/features/ai/healthcare-wellbeing/">7 ways AI is advancing healthcare and wellbeing around the world</a></h2>
              <div>April 12, 2026</div>
              <p>Microsoft highlights broad healthcare and social impact examples.</p>
            </section>
            <section>
              <h2><a href="/source/features/ai/developers-ai-agents/">Meet 4 developers leading the way with AI agents</a></h2>
              <div>May 19, 2025</div>
              <p>Developers are using agents to automate workflows and build AI agent teams.</p>
            </section>
            <section>
              <h2><a href="/source/features/ai/secure-software-ai/">Strengthening secure software at global scale: How MSRC is evolving with AI</a></h2>
              <div>April 10, 2026</div>
              <p>Microsoft details how AI is changing secure software workflows inside MSRC.</p>
            </section>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(
      {
        ...microsoftSource,
        maxItems: 2
      },
      fetchFn as typeof fetch
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual([
      "Meet 4 developers leading the way with AI agents",
      "Strengthening secure software at global scale: How MSRC is evolving with AI"
    ]);
  });

  it("parses heading-link layouts used by mistral news pages", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <main>
              <h3><a href="/news/compute-benchmarking">Benchmarking with Mistral Compute</a></h3>
              <div>Mar 23, 2026</div>
              <p>Mistral details new infrastructure and developer workflow updates.</p>
            </main>
          </body>
        </html>
      `
    });

    const items = await fetchHtmlItems(mistralSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://mistral.ai/news/compute-benchmarking",
      title: "Benchmarking with Mistral Compute",
      summary: "Mistral details new infrastructure and developer workflow updates.",
      sourceType: "COMPANY_UPDATE",
      sourceLabel: "Mistral AI News",
      sourceCatalogId: "official-mistral-news"
    });
    expect(items[0]?.publishedAt).toContain("2026");
  });
});
