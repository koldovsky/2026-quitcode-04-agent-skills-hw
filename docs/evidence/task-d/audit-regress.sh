#!/usr/bin/env bash
# Runs audit-regress.mjs against a fresh production build of an app dir (this repo, or an A/B copy).
#   bash docs/evidence/task-d/audit-regress.sh <out file> [<app dir>, default: this repo]
# The app gets throw-away test values generated here (never .env.local, never printed); exported variables
# take precedence over .env* files in Next.js. Exit code = the checks' exit code.
set -uo pipefail
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
OUT="$1"; mkdir -p "$(dirname "$OUT")"; APP=$(cd "${2:-$REPO}" && pwd)
cd "$APP"
. "$REPO/docs/evidence/bin/server.sh"
N8N_WEBHOOK_TOKEN=$(openssl rand -hex 24); N8N_CALLBACK_SECRET=$(openssl rand -hex 32)
export N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET
export N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5679/webhook APP_BASE_URL=http://127.0.0.1:3000
BLOG=$(mktemp); SLOG=$(mktemp)
npm run build >"$BLOG" 2>&1 || { echo "build failed:"; tail -20 "$BLOG"; exit 1; }
start_server "$SLOG"
trap 'stop_server; rm -f "$BLOG" "$SLOG"' EXIT
{
  echo "# audit regression · $(basename "$APP") $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- app lib components || echo +worktree) · build $BUILD_ID · pid $SERVER_PID · $(date -u +%FT%TZ)"
  node "$REPO/docs/evidence/task-d/audit-regress.mjs"
} 2>&1 | tee "$OUT"
exit "${PIPESTATUS[0]}"
