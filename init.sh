#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Role Radar harness init"
echo "root: $ROOT_DIR"

required_files=(
  "AGENTS.md"
  "README.md"
  "DESIGN.md"
  "scripts/verify.sh"
  "package.json"
  "prisma/schema.prisma"
)

missing=0
for rel in "${required_files[@]}"; do
  if [[ ! -e "$ROOT_DIR/$rel" ]]; then
    echo "missing: $rel"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "init failed: required harness files are missing"
  exit 1
fi

if [[ -f "$ROOT_DIR/package.json" ]]; then
  echo "package.json detected"
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "note: dependencies are not installed yet"
  fi
else
  echo "note: application runtime is not scaffolded yet"
fi

echo "==> Running baseline verification"
"$ROOT_DIR/scripts/verify.sh"

echo "==> Init complete"
