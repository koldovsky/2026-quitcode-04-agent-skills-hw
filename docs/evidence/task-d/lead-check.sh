#!/usr/bin/env bash
# Task D, finishing step: the old lead form now goes through lib/n8n/client in after().
#   bash docs/evidence/task-d/lead-check.sh   (repo root, after npm run build; needs .env.local)
# Submits the public lead form (/) the way a browser without JS does, with the mock in its default
# "immediately" mode, and shows the mock log line and the timing. No secret value is printed.
set -uo pipefail
OUT=docs/evidence/task-d/branch/lead-check.txt; SLOG=$(mktemp); MLOG=$(mktemp); PAGE=$(mktemp)
. docs/evidence/bin/server.sh
start_server "$SLOG"
node --env-file=.env.local tools/mock-n8n.mjs > "$MLOG" 2>&1 & MOCK_PID=$!
trap 'stop_server; kill $MOCK_PID 2>/dev/null; rm -f "$SLOG" "$MLOG" "$PAGE"' EXIT
for _ in $(seq 1 25); do curl -s -o /dev/null 127.0.0.1:5678/healthz && break; sleep 0.2; done
curl -s -o "$PAGE" 127.0.0.1:3000/
ARGS=()
while IFS= read -r l; do ARGS+=(--form-string "$l"); done < <(node -e '
const html = require("fs").readFileSync(process.argv[1], "utf8");
const form = html.slice(html.indexOf("<form"), html.indexOf("</form>"));
for (const m of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g))
  console.log(`${m[1]}=${(m[2] ?? "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&")}`);' "$PAGE")
{
  echo "# lead-created check · $(git rev-parse --short HEAD) · build $BUILD_ID · pid $SERVER_PID · $(date -u +%FT%TZ)"
  curl -s --max-time 30 -o /dev/null -X POST 127.0.0.1:3000/ "${ARGS[@]}" \
    --form-string firstName=Scenario --form-string lastName=Person --form-string email=lead.person@example.test \
    --form-string phone="+380 44 000 0000" --form-string company="Lead Check LLC" --form-string website="" \
    --form-string message="LEAD-CHECK message" --form-string consentMarketing=on \
    -w "no-JS POST / (lead form) -> HTTP %{http_code} in %{time_total} s\n"
  sleep 2
  echo "mock log (mode immediately):"; grep -E "POST /webhook" "$MLOG" | sed 's/sha256=[0-9a-f]*//; s/^/  | /'
  echo "server log n8n lines:"; grep -E '"n8n"|n8n' "$SLOG" | sed 's/^/  | /'
  echo "server log lines with the submitted email / phone / message: $(grep -cE 'lead.person@|\+380 44|LEAD-CHECK' "$SLOG" || true)"
} | tee "$OUT"
