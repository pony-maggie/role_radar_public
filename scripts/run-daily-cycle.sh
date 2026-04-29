#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${ROLE_RADAR_DAILY_DRY_RUN:-0}"
INCLUDE_MANUAL="${ROLE_RADAR_DAILY_INCLUDE_MANUAL:-0}"
SKIP_NOTIFICATIONS="${ROLE_RADAR_DAILY_SKIP_NOTIFICATIONS:-0}"
ENABLE_ROLE_DISCOVERY="${ROLE_RADAR_DAILY_ENABLE_ROLE_DISCOVERY:-0}"
ROLE_DISCOVERY_LIMIT="${ROLE_RADAR_DAILY_ROLE_DISCOVERY_LIMIT:-5}"

ingest_cmd=(npm run ingest:signals)
if [[ "$INCLUDE_MANUAL" == "1" ]]; then
  ingest_cmd+=(-- --include-manual)
fi

role_discovery_cmd=(npm run discovery:roles -- "--limit=${ROLE_DISCOVERY_LIMIT}")

notifications_cmd=(npm run notifications:run)

if [[ "$DRY_RUN" == "1" ]]; then
  printf 'dry-run: %s\n' "cd $ROOT_DIR"
  printf 'dry-run: %s\n' "${ingest_cmd[*]}"
  if [[ "$ENABLE_ROLE_DISCOVERY" == "1" ]]; then
    printf 'dry-run: %s\n' "${role_discovery_cmd[*]}"
  else
    echo "dry-run: skip role discovery"
  fi
  if [[ "$SKIP_NOTIFICATIONS" == "1" ]]; then
    echo "dry-run: skip notifications"
  else
    printf 'dry-run: %s\n' "${notifications_cmd[*]}"
  fi
  exit 0
fi

cd "$ROOT_DIR"

echo "==> Role Radar daily cycle"
echo "root: $ROOT_DIR"
echo "step: ingest signals"
"${ingest_cmd[@]}"

if [[ "$ENABLE_ROLE_DISCOVERY" == "1" ]]; then
  echo "step: role discovery"
  "${role_discovery_cmd[@]}"
else
  echo "step: role discovery skipped"
fi

if [[ "$SKIP_NOTIFICATIONS" == "1" ]]; then
  echo "step: notifications skipped"
  exit 0
fi

echo "step: queue/send notifications"
"${notifications_cmd[@]}"

echo "==> Daily cycle complete"
