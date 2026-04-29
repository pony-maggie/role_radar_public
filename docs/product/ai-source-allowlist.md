# AI Source Allowlist

This file records the maintained source allowlist for `Role Radar`.

## Policy

- Keep the list short and opinionated.
- Prefer sources with high signal density around AI product launches, model releases, and workflow adoption.
- Use automated ingestion only for sources that are easy to fetch and reproduce.
- Keep official newsroom sources in the catalog as observe-only watchlist entries unless a dedicated role mapper exists.
- Keep `X/Twitter` out of automated ingestion. It is noisy, brittle, and hard to reproduce in a deterministic allowlist.

## Automated Sources

These sources are enabled by default today and are safe to ingest without manual review:

- OpenAI Newsroom
- Hugging Face Blog
- GitHub Blog AI & ML
- Microsoft Source AI
- TechCrunch AI
- VentureBeat AI

## Official Watchlist

These are high-value AI official sources that stay in the maintained catalog, but they are still `manual_html` and not enabled by default:

- Anthropic News
- Google DeepMind Blog
- Cohere Blog
- Mistral AI News

Current parser support:

- Anthropic News
- Google DeepMind Blog
- GitHub Blog AI & ML
- Microsoft Source AI
- Cohere Blog
- Mistral AI News
- Hugging Face Blog

Mapping policy:

- official newsroom entries remain `observe_only`
- no direct-mapped fallback role slug is attached to the newsroom sources

## Jobs Watchlist

These are useful for hiring-signal deltas and workflow adoption clues, but they should remain explicit watchlist sources rather than broad default feeds:

- OpenAI Careers
- Anthropic Careers

## Manual Watchlist

These sources are maintained in the catalog for operator review and later expansion, but they are not enabled by default:

- The Decoder
- InfoQ AI/ML/Data Engineering
- AIbase
- 机器之心
- 量子位

Current parser support:

- The Decoder
- InfoQ AI/ML/Data Engineering
- AIbase
- 机器之心
- 量子位

## Notes

- Official blogs and newsrooms are treated as the highest-confidence layer.
- AI-focused media is the second layer, used to catch applied case studies and broader ecosystem changes.
- Chinese-language AI sources are listed separately so the catalog can stay bilingual without forcing the automated pipeline to become noisy.
- Chinese role translation coverage is expanded for visible AI-adjacent roles in the static dictionary so the bilingual UI stays readable without expanding source-mapping risk.
- Jobs sources remain cataloged but parser-disabled until a careers-specific extraction strategy is designed.
- Source-by-source validation should use `npm run ingest:signals -- --source=<id> --dry-run` so disabled official watchlist sources can be tested one at a time before any default enablement change.
- As of 2026-04-15, both `GitHub Blog AI & ML` and `Microsoft Source AI` clear the stricter local bar of `fetched > 0` plus accepted role attribution and have been promoted into the default-enabled set.
