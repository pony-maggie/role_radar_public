#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Verifying Role Radar repository"
cd "$ROOT_DIR"
export DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"

required_files=(
  "AGENTS.md"
  "README.md"
  "DESIGN.md"
  "init.sh"
  "package.json"
  "prisma/schema.prisma"
)

for rel in "${required_files[@]}"; do
  [[ -f "$rel" ]] || { echo "missing required file: $rel"; exit 1; }
done

if [[ ! -x "init.sh" ]]; then
  echo "init.sh is not executable"
  exit 1
fi

if [[ ! -x "scripts/verify.sh" ]]; then
  echo "scripts/verify.sh is not executable"
  exit 1
fi

npx prisma validate
npm run db:generate
npx prisma migrate deploy
npx prisma migrate status
npm run db:seed
npm run lint
npm run test:unit
npm run build
npm run test:e2e

echo "verification passed"
