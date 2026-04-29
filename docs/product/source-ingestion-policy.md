# Source Ingestion Policy

This document defines how `Role Radar` should collect, classify, rank, and persist external information for role-level AI replacement tracking.

It is the product-facing policy layer above the maintained source catalog in [ai-source-allowlist.md](ai-source-allowlist.md).

## Goal

`Role Radar` is not a general hot-news product.

The purpose of ingestion is not to surface whatever is trending. The purpose is to collect a bounded set of AI-related signals that can help answer:

- which role may be affected
- why that role may be affected
- whether the signal should influence the role's displayed replacement rate

That means source ingestion must optimize for:

- relevance to AI capability, adoption, or hiring shifts
- reproducibility
- bounded noise
- clear downstream role attribution

## Product Principles

### 1. Role relevance beats news heat

A source item is valuable only if it can plausibly help explain a role's current or changing exposure to AI.

Pure “hot topic” value is not enough.

Examples of weak signals:

- general AI funding news
- broad ecosystem commentary with no workflow implication
- vague “AI is changing everything” analysis

Examples of stronger signals:

- official capability updates that expand automation scope
- case studies showing AI replacing or absorbing real workflow steps
- job postings that show role restructuring or AI-tool expectations

### 2. Short allowlist, not open-web crawling

The system should maintain an opinionated source list rather than broad search-based scraping.

Why:

- easier to reproduce
- easier to debug
- lower noise
- more stable daily ingest behavior

### 3. Source class matters

Not all sources are equal. The same article shape does not imply the same product value.

`Role Radar` should treat:

- official sources as the strongest trust layer
- AI-focused media as the second layer
- jobs/careers as a lower-weight supporting layer
- social chatter as out of scope for automated ingestion

### 4. Daily output should stay bounded

The product updates daily. It does not need minute-level ingestion or a “catch everything” pipeline.

The system should prefer:

- once-per-day ingest
- per-source caps
- clear skip/fail behavior
- stable persistence over maximum volume

## Source Classes

### Official

Definition:

- company blogs
- product updates
- research/model release blogs
- newsroom announcements from AI labs or closely related platforms

Examples:

- OpenAI Newsroom
- Anthropic News
- Google DeepMind Blog
- Hugging Face Blog

Expected product value:

- strongest evidence for new AI capability or deployment direction
- strongest evidence for shifts in what workflows AI can absorb

Default policy:

- keep in automated catalog if fetching is stable
- attribute to roles conservatively
- allow into public role evidence when model attribution is strong enough

### Media

Definition:

- AI-focused or tech-focused news outlets covering product launches, applied cases, and adoption stories

Examples:

- TechCrunch AI
- VentureBeat AI
- The Decoder
- InfoQ AI/ML/Data Engineering
- 机器之心
- 量子位
- AIbase
- 36氪 AI / 科技
- IT之家 AI / 科技

Expected product value:

- fills in adoption cases, deployment stories, and operator-facing workflow changes
- useful for showing concrete examples on role pages

Default policy:

- automated only when fetch quality is stable
- more conservative than official sources
- should not dominate scoring when evidence is weak

### Jobs

Definition:

- careers pages
- job postings
- hiring feeds that indicate changing role structure

Examples:

- OpenAI Careers
- Anthropic Careers

Expected product value:

- supporting evidence only
- useful for spotting AI-tool expectations or role restructuring
- useful for showing what companies now expect humans to do alongside AI

Default policy:

- lower weight than official/media
- should rarely move a role score alone
- best used as corroboration

### Excluded From Automated Ingestion

The following should stay out of the automated pipeline by default:

- X / Twitter
- Reddit
- forum threads
- anonymous leaks
- repost farms
- aggregation accounts with no stable source chain

Reason:

- too noisy
- weak reproducibility
- weak citation chain
- poor fit for daily structured role reasoning

## Signal Types

Each ingested item should be interpretable as one of these product-facing signal types:

- `capability_update`
  New model, tool, or product capability that plausibly expands automation reach.
- `adoption_case`
  Real-world company or workflow adoption example.
- `workflow_restructure`
  Evidence that a human workflow is being redesigned around AI.
- `hiring_shift`
  Evidence from job postings or hiring language that expectations are changing.
- `ecosystem_context`
  Useful context, but weaker direct role impact.

These are more useful to `Role Radar` than generic categories like “tech news” or “hot topic”.

## Ingestion Workflow

### 1. Fetch

For each enabled source:

- fetch the newest items
- apply per-source caps
- normalize title, url, summary, published time, source metadata
- fail closed when the parser does not support the source shape

### 2. Filter

Drop items that are:

- duplicates
- too old for the current window
- obviously non-AI
- clearly unrelated to workflow or role impact

### 2.5 Item strategy layer

Before Gemini attribution runs, each normalized source item is assigned a lightweight product strategy:

- official capability update
- media adoption case
- jobs hiring shift
- broad ecosystem context

This strategy does not replace Gemini reasoning. It constrains defaults, weighting, and whether the item is even eligible to affect a role's replacement rate.
The attachment bar is intentionally broader than the score-impact bar: a source item can still attach to a role timeline through stored attribution even when normalized signal policy keeps it out of replacement-rate inputs.

### 3. Classify

For each remaining item, infer:

- source class
- signal type
- likely role attribution
- explanation of why the item matters
- impact direction if applicable

Role candidate recall should expand through curated role aliases plus source topic hints before Gemini sees the item.
Official and jobs sources can use a more balanced recall pass, while broader media items should stay tighter so weak ecosystem chatter does not force role attribution.
Structured generation should try Gemini first and MiniMax second for fallback-eligible provider failures.
If both providers are unavailable, disabled, or misconfigured, the ingest run should fall back to a bounded local conservative classifier so one provider outage does not abort the whole source batch.

### 4. Persist

Persist the raw source item and model inference outputs so the attribution chain stays inspectable.
Persist accepted timeline linkage even when the item is not eligible to create a `Signal` row, so public/source diagnostics can show broader role attachment than replacement-rate evidence.

### 5. Refresh role presentation

Only after persistence should affected role summaries and replacement rates refresh.

The public app should continue reading stored outputs, not invoking live model calls at page render time.

## Ranking And Weighting

The ingest pipeline should not treat all items equally.

Recommended weighting order:

1. official capability or deployment updates
2. strong applied case studies from high-quality media
3. corroborating media coverage
4. jobs/careers signals
5. general ecosystem context

This should influence model prompting and downstream score interpretation.

It should not be exposed as a rigid public formula, but it should remain stable enough for consistent behavior.

## What Can Affect The Replacement Rate

An item is eligible to influence a role's displayed replacement rate when all of the following are true:

- it is AI-relevant
- it can be plausibly attached to a role
- it contains direct or near-direct evidence of workflow impact
- it is not just generic industry hype

Examples that should influence the role score:

- official product updates that expand realistic automation ability for the role
- adoption cases showing real workflow replacement or compression
- multiple aligned signals from official + media sources

Examples that usually should not influence the score directly:

- investor/funding news
- broad opinion pieces
- weakly related media summaries
- job posts with no clear workflow implication

## What Can Still Be Stored But De-Emphasized

Some items are worth storing even if they should not heavily affect scoring:

- ecosystem context
- weakly related AI coverage
- ambiguous but potentially useful role signals

These items may still:

- appear in diagnostics
- help future model improvement
- support later human review or prompt tuning

But they should not dominate the public role page.

## Relationship To Hot-News Aggregation

Traditional hot-news aggregation optimizes for:

- freshness
- breadth
- category coverage

`Role Radar` instead optimizes for:

- role attribution
- signal quality
- daily stability
- evidence usefulness

So the “hot news” pattern is only partially reusable.

Useful ideas to borrow:

- maintained source allowlist
- de-duplication
- trust-based source layering
- structured output

What should not be copied directly:

- generic “society / tech / military” categorization
- broad headline summarization without role impact
- trend-first ranking with no occupational interpretation

## Recommended Source Expansion Direction

When expanding beyond the current allowlist, prefer this order:

1. additional official AI sources with stable RSS or predictable HTML
2. AI-focused media with good article structure
3. Chinese AI/tech media with bounded parser support
4. jobs sources with structured metadata

Avoid expanding by topic breadth alone.

If a source increases volume more than it increases role-relevant signal quality, it should not be enabled by default.

## Operational Guidance

Daily operations should continue using:

```bash
npm run ops:daily
```

Recommended production rhythm:

- run once per day
- keep source caps small
- inspect dry-run output when new sources are added

Useful local commands:

```bash
npm run ingest:signals -- --list
npm run ingest:signals -- --dry-run
npm run ingest:signals -- --dry-run --include-manual
```

## Future Extensions

Possible later additions:

- a dedicated Chinese-source ingestion tier
- richer source-level trust scoring
- “why this was ignored” diagnostics for weak signals
- role-cluster attribution when one item affects multiple adjacent roles

These are useful later, but not required for the current daily product loop.
