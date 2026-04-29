# Role Radar / 职危图谱

Role Radar is a bilingual web app that estimates how exposed different jobs are to AI-driven replacement pressure. It combines a static occupation dictionary, curated AI/news/job sources, cached model reasoning, and a public Next.js interface for browsing role risk, evidence timelines, and trend history.

职危图谱是一个中英文双语网站，用来观察不同岗位受到 AI 自动化影响的程度。它结合静态岗位词典、经过筛选的信息源、可缓存的模型推理结果，以及面向公众的岗位详情页，展示岗位替代率、原因、证据时间线和历史趋势。

## Screenshots / 截图


| View | Placeholder path |
| --- | --- |
| 网站效果1 | `docs/assets/screenshots/1.png` |
| 网站效果2 | `docs/assets/screenshots/2.png` |
| 网站效果3 | `docs/assets/screenshots/3.png` |

## What It Does

- Browse or search a bilingual occupation catalog.
- Show a stored AI replacement-rate estimate for each materialized role.
- Explain the estimate with structural reasons and evidence items.
- Track week/month replacement-rate trends when snapshots are available.
- Let signed-in users maintain a small watchlist and receive notification digests.
- Run background ingest/discovery jobs that update source evidence outside normal page requests.

## 产品功能

- 支持按中英文搜索和浏览岗位。
- 为已物化的岗位展示已存储的 AI 替代率估计。
- 用结构性原因和证据时间线解释替代率。
- 在有历史快照时展示周/月趋势。
- 支持邮箱验证码登录后的岗位 watchlist 和通知摘要。
- 后台任务负责信息源抓取、搜索发现、模型归因和风险刷新；普通页面访问不直接调用模型。

## Architecture

```text
Next.js App Router UI
        |
Application use cases
        |
Repositories + Prisma
        |
SQLite

Background jobs:
Source catalog / search discovery
        -> item normalization
        -> Gemini / MiniMax / local fallback classification
        -> persisted source evidence
        -> role-risk refresh
        -> trend snapshots
```

Key boundaries:

- Public pages read stored data from SQLite.
- Model calls happen in ingest, discovery, regression, or refresh commands.
- Source items and model outputs are persisted for replay and debugging.
- Search-discovery evidence is downweighted compared with primary curated sources.
- Watchlist auth uses email verification codes; there is no separate `User` table.

## 架构与原理

```text
Next.js App Router 前端
        |
应用层用例
        |
Repository + Prisma
        |
SQLite

后台任务：
信息源目录 / 搜索发现
        -> 内容标准化
        -> Gemini / MiniMax / 本地保守 fallback 归因
        -> 存储证据
        -> 刷新岗位风险
        -> 保存趋势快照
```

主要边界：

- 公开页面只读取 SQLite 中的已存储结果。
- 模型调用只发生在抓取、搜索发现、回归测试或刷新命令中。
- 原始信息项和模型输出会持久化，便于复盘和调试。
- 搜索发现证据的权重低于人工维护的主要信息源。
- Watchlist 使用邮箱验证码登录；当前 schema 没有独立 `User` 表。

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Prisma
- SQLite
- Vitest
- Playwright
- Gemini and MiniMax provider integrations

## Local Development

Install dependencies:

```bash
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

Initialize the database and start the app:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open:

- `http://127.0.0.1:3000/en`
- `http://127.0.0.1:3000/zh`

Optional one-command local workflow:

```bash
./scripts/start-local.sh
./scripts/stop-local.sh
```

`start-local.sh` applies migrations, seeds demo data, starts the Next.js dev server, and opens the browser. It preserves previously ingested source data unless `ROLE_RADAR_RESET_INGEST_DATA=1` is set before seeding.

## Environment Variables

Copy [.env.example](.env.example) and fill only the integrations you need.

Core local defaults:

```dotenv
DATABASE_URL=file:./prisma/dev.db
ROLE_RADAR_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
AUTH_SECRET=replace-with-a-long-random-string
REVIEW_QUEUE_TOKEN=replace-with-a-local-token
```

AI providers are optional for ordinary browsing, but needed for live ingest, discovery, refresh, and regression commands:

```dotenv
GEMINI_API_KEY=
MINIMAX_API_KEY=
BRAVE_SEARCH_API_KEY=
```

SMTP and Turnstile are optional in local development.

## Useful Commands

```bash
npm run db:generate
npm run db:seed
npm run db:import-dictionary
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run verify
```

Data and operations commands:

```bash
npm run ingest:signals -- --list
npm run ingest:signals -- --dry-run
npm run ingest:signals -- --dry-run --with-gemini
npm run discovery:roles
npm run ops:refresh-all-roles
npm run notifications:run
npm run ops:daily
npm run regression:inference
```

## Data Sources

The repository includes:

- a static role dictionary at `data/dictionaries/role_categories.csv`
- curated source catalog definitions under `lib/ingest/`
- regression fixtures under `data/regression/`
- Prisma migrations and seed data for a local SQLite database

The source catalog is intentionally conservative. Unsupported or noisy HTML sources should stay disabled until they have a source-specific extractor and regression coverage.

## Verification

Run the full repository gate:

```bash
./scripts/verify.sh
```

This runs Prisma checks, migrations, seed, lint, unit tests, production build, and Playwright e2e tests.

## Security Notes

- Do not commit `.env` files.
- Rotate any secret that was ever committed to a private history before publishing a public mirror.
- Public pages should not call Gemini, MiniMax, Brave, SMTP, or Turnstile directly.
- Production deployment files and real server runbooks should live outside a public mirror unless they have been scrubbed.

## License

MIT. See [LICENSE](LICENSE).
