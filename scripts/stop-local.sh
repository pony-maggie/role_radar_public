#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/tmp"
PID_FILE="${ROLE_RADAR_PID_FILE:-$TMP_DIR/role-radar-dev.pid}"
PORT="${ROLE_RADAR_PORT:-3000}"
DRY_RUN="${ROLE_RADAR_DRY_RUN:-0}"

stop_pid() {
  local pid="$1"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
  done

  kill -9 "$pid" 2>/dev/null || true
}

if [[ "$DRY_RUN" == "1" ]]; then
  echo "dry-run: stop pid from $PID_FILE"
  echo "dry-run: free tcp port $PORT"
  echo "dry-run: cleanup pid file"
  exit 0
fi

mkdir -p "$TMP_DIR"

if [[ -f "$PID_FILE" ]]; then
  recorded_pid="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$recorded_pid" ]]; then
    echo "Stopping recorded pid $recorded_pid"
    stop_pid "$recorded_pid"
  fi
fi

port_pids="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
if [[ -n "$port_pids" ]]; then
  echo "Freeing tcp port $PORT"
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    stop_pid "$pid"
  done <<< "$port_pids"
fi

rm -f "$PID_FILE"
echo "Local Role Radar server stopped"
