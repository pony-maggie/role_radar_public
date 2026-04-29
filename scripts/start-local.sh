#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/tmp"
PID_FILE="${ROLE_RADAR_PID_FILE:-$TMP_DIR/role-radar-dev.pid}"
LOG_FILE="${ROLE_RADAR_LOG_FILE:-${ROLE_RADAR_LOG_PATH:-$TMP_DIR/role-radar-dev.log}}"
DISCOVERY_LOG_FILE="${ROLE_RADAR_DISCOVERY_LOG_FILE:-$TMP_DIR/role-radar-discovery.log}"
HOST="${ROLE_RADAR_HOST:-127.0.0.1}"
PORT="${ROLE_RADAR_PORT:-3000}"
REVIEW_TOKEN="${ROLE_RADAR_REVIEW_TOKEN:-local-review}"
BASE_URL="http://$HOST:$PORT"
START_PATH="${ROLE_RADAR_START_PATH:-/en}"
START_URL="$BASE_URL$START_PATH"
HEALTHCHECK_TIMEOUT_SECONDS="${ROLE_RADAR_HEALTHCHECK_TIMEOUT_SECONDS:-45}"
DRY_RUN="${ROLE_RADAR_DRY_RUN:-0}"
NO_OPEN="${ROLE_RADAR_NO_OPEN:-0}"
LOCAL_DISCOVERY_LIMIT="${ROLE_RADAR_LOCAL_ROLE_DISCOVERY_LIMIT:-5}"
LOCAL_DISCOVERY_ENABLED="${ROLE_RADAR_LOCAL_BOOTSTRAP_ROLE_DISCOVERY:-auto}"
ENV_FILE="${ROLE_RADAR_ENV_FILE:-$ROOT_DIR/.env}"

has_configured_brave_key() {
  if [[ -n "${BRAVE_SEARCH_API_KEY:-}" ]]; then
    return 0
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    return 1
  fi

  local env_line
  env_line="$(grep -E '^BRAVE_SEARCH_API_KEY=' "$ENV_FILE" | tail -n 1 || true)"
  env_line="${env_line#BRAVE_SEARCH_API_KEY=}"
  env_line="${env_line%\"}"
  env_line="${env_line#\"}"
  [[ -n "$env_line" ]]
}

should_run_local_discovery() {
  if [[ "$LOCAL_DISCOVERY_ENABLED" == "1" ]]; then
    return 0
  fi

  if [[ "$LOCAL_DISCOVERY_ENABLED" == "0" ]]; then
    return 1
  fi

  has_configured_brave_key
}

if [[ "$DRY_RUN" == "1" ]]; then
  echo "dry-run: stop existing Role Radar local process"
  echo "dry-run: seed database (preserve ingested timelines)"
  echo "dry-run: start Next.js dev server on $BASE_URL"
  if should_run_local_discovery; then
    echo "dry-run: bootstrap local role discovery in background with npm run discovery:roles -- --limit=$LOCAL_DISCOVERY_LIMIT"
  else
    echo "dry-run: skip local role discovery bootstrap"
  fi
  echo "dry-run: open browser $START_URL"
  exit 0
fi

mkdir -p "$TMP_DIR"

echo "Stopping any existing local Role Radar process"
"$ROOT_DIR/scripts/stop-local.sh"

echo "Seeding local database while preserving ingested timelines"
cd "$ROOT_DIR"
export DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"
npx prisma migrate deploy
npm run db:seed

echo "Starting Next.js dev server on $BASE_URL"
if command -v setsid >/dev/null 2>&1; then
  nohup setsid env DATABASE_URL="$DATABASE_URL" REVIEW_QUEUE_TOKEN="$REVIEW_TOKEN" npm run dev -- --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 < /dev/null &
else
  nohup env DATABASE_URL="$DATABASE_URL" REVIEW_QUEUE_TOKEN="$REVIEW_TOKEN" npm run dev -- --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 < /dev/null &
fi
server_pid=$!
echo "$server_pid" > "$PID_FILE"

deadline=$((SECONDS + HEALTHCHECK_TIMEOUT_SECONDS))
until curl -fsS "$START_URL" >/dev/null 2>&1; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Local server exited unexpectedly. Recent log output:"
    tail -n 40 "$LOG_FILE" || true
    exit 1
  fi

  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for $START_URL"
    tail -n 40 "$LOG_FILE" || true
    exit 1
  fi

  sleep 1
done

echo "Role Radar is ready at $START_URL"
echo "pid: $server_pid"
echo "log: $LOG_FILE"
echo "review queue: $BASE_URL/en/sources?reviewToken=$REVIEW_TOKEN"

if should_run_local_discovery; then
  echo "Bootstrapping local role discovery in background"
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid env DATABASE_URL="$DATABASE_URL" npm run discovery:roles -- "--limit=$LOCAL_DISCOVERY_LIMIT" >"$DISCOVERY_LOG_FILE" 2>&1 < /dev/null &
  else
    nohup env DATABASE_URL="$DATABASE_URL" npm run discovery:roles -- "--limit=$LOCAL_DISCOVERY_LIMIT" >"$DISCOVERY_LOG_FILE" 2>&1 < /dev/null &
  fi
  echo "discovery log: $DISCOVERY_LOG_FILE"
else
  echo "Skipping local role discovery bootstrap"
fi

if [[ "$NO_OPEN" == "1" ]]; then
  echo "Skipping browser open because ROLE_RADAR_NO_OPEN=1"
  exit 0
fi

if command -v open >/dev/null 2>&1; then
  open "$START_URL"
else
  echo "open command not found; open this URL manually: $START_URL"
fi
