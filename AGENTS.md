# AGENTS.md

This public repository keeps a lightweight startup path for coding agents.

## Startup

1. Read `README.md`.
2. Read `DESIGN.md` for visual direction.
3. Run `npm install` or `npm ci` if dependencies are missing.
4. Run `./scripts/verify.sh` before claiming a feature is complete.

## Working Rules

- Do not commit secrets or local `.env` files.
- Keep public documentation focused on product, architecture, setup, and verification.
- Prefer small, restart-safe changes.
- Add tests for behavior changes when practical.

## Verification

Run:

```bash
./scripts/verify.sh
```

The verification script validates Prisma, applies local migrations, seeds demo data, runs lint, unit tests, build, and Playwright e2e tests.
