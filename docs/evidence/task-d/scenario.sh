#!/usr/bin/env bash
# Task D, step 3.4: the same mock scenario for every run.
#   [MATRIX_URL=http://127.0.0.1:3000/<callback path, {id} allowed>] bash docs/evidence/task-d/scenario.sh <copy dir> <out dir> [extra mock flags…]
# The copy must already have .env.local (the agent's variables + N8N_WEBHOOK_TOKEN / N8N_CALLBACK_SECRET
# for the mock). Builds the copy, starts it on :3000 (docs/evidence/bin/server.sh), starts the mock FROM
# THIS REPO (tools/mock-n8n.mjs --mode respond-202 --delay 5000, secrets via --env-file of the copy),
# submits /quotes/new the way a browser without JS does (fields found by name in the server HTML),
# waits for the callback, opens /quotes/<id>, greps the server log for the submitted personal data.
# No secret value is printed: the env file is only passed to node with --env-file.
set -uo pipefail
REPO=$(cd "$(dirname "$0")/../../.." && pwd)
COPY=$(cd "$1" && pwd); OUT=$(mkdir -p "$2" && cd "$2" && pwd); shift 2
MOCK_FLAGS=(--mode respond-202 --delay 5000 "$@")
[ -f "$COPY/.env.local" ] || { echo "no .env.local in $COPY" >&2; exit 2; }
cd "$COPY"
. "$REPO/docs/evidence/bin/server.sh"
SLOG="$OUT/server.log"; MLOG="$OUT/mock.log"; PAGE=$(mktemp); BODY=$(mktemp); HDRS=$(mktemp)
npm run build > "$OUT/build.log" 2>&1 || { echo "build failed, see build.log"; tail -20 "$OUT/build.log"; exit 1; }
start_server "$SLOG"
node --env-file=.env.local "$REPO/tools/mock-n8n.mjs" "${MOCK_FLAGS[@]}" > "$MLOG" 2>&1 &
MOCK_PID=$!
trap 'stop_server; kill $MOCK_PID 2>/dev/null; rm -f "$PAGE" "$BODY" "$HDRS"' EXIT
for _ in $(seq 1 25); do curl -s -o /dev/null 127.0.0.1:5678/healthz && break; sleep 0.2; done

COMPANY="Scenario Test LLC"; EMAIL="scenario.person@example.test"; DESC="SCENARIO-DESC landing page and CRM sync"; BUDGET=50000
{
echo "# scenario · copy $(basename "$COPY") $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- app lib components 2>/dev/null || echo +worktree) · build $BUILD_ID · server pid $SERVER_PID · $(date -u +%FT%TZ)"
echo "mock: tools/mock-n8n.mjs ${MOCK_FLAGS[*]} (from the working repo, --env-file=.env.local of the copy)"
echo ".env.local keys (names only): $(grep -oE '^[A-Z0-9_]+' .env.local | tr '\n' ' ')"
curl -s -o "$PAGE" -w "GET /quotes/new -> %{http_code}\n" 127.0.0.1:3000/quotes/new
ARGS=()
while IFS= read -r l; do ARGS+=(--form-string "$l"); done < <(COMPANY="$COMPANY" EMAIL="$EMAIL" DESC="$DESC" BUDGET="$BUDGET" node -e '
const html = require("fs").readFileSync(process.argv[1], "utf8");
const start = html.indexOf("<form"), end = html.indexOf("</form>", start);
const form = html.slice(start, end);
const unq = (s) => s.replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#x27;/g, "\x27");
const out = [];
for (const m of form.matchAll(/<(input|textarea|select)\b([^>]*)>/g)) {
  const attrs = m[2]; const name = /\bname="([^"]+)"/.exec(attrs)?.[1]; if (!name) continue;
  const type = /\btype="([^"]+)"/.exec(attrs)?.[1] ?? m[1];
  if (type === "hidden") { out.push(`${name}=${unq(/\bvalue="([^"]*)"/.exec(attrs)?.[1] ?? "")}`); continue; }
  const n = name.toLowerCase();
  if (m[1] === "select") { // a <select>: take a real option of it (the last non-empty one), not our free-text value
    const body = form.slice(m.index, form.indexOf("</select>", m.index));
    const opts = [...body.matchAll(/<option\b[^>]*\bvalue="([^"]+)"/g)].map((o) => o[1]);
    if (opts.length) { out.push(`${name}=${unq(opts.at(-1))}`); continue; }
  }
  const v = /mail/.test(n) ? process.env.EMAIL : /compan|org/.test(n) ? process.env.COMPANY
    : /budget/.test(n) ? process.env.BUDGET : /desc|task|detail|message|brief|text/.test(n) ? process.env.DESC : null;
  if (v === null) { console.error(`unmapped field: ${name}`); continue; }
  out.push(`${name}=${v}`);
}
console.log(out.join("\n"));' "$PAGE")
NAMES=""; for a in "${ARGS[@]}"; do [ "$a" != "--form-string" ] && NAMES="$NAMES ${a%%=*}"; done
echo "form fields posted:$NAMES"
T0=$(date +%s)
curl -s --max-time 30 -o "$BODY" -D "$HDRS" -X POST 127.0.0.1:3000/quotes/new "${ARGS[@]}" \
  -w "no-JS POST /quotes/new -> HTTP %{http_code} in %{time_total} s (TTFB %{time_starttransfer} s)\n"
LOC=$(grep -i '^location:' "$HDRS" | tr -d '\r' | awk '{print $2}')
[ -z "$LOC" ] && LOC=$(grep -oE '/quotes/[A-Za-z0-9_-]{6,}' "$BODY" | grep -v '/quotes/new' | head -1)
echo "redirect / status page: ${LOC:-<none>}"
sleep 1
echo "mock log right after the POST:"; sed 's/^/  | /' "$MLOG"
page_state() { curl -s "127.0.0.1:3000$LOC" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=s.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
const i=t.search(/статус|status/i);console.log(i<0?t.slice(0,200):t.slice(Math.max(0,i-60),i+200))})'; }
[ -n "$LOC" ] && echo "/quotes/<id> before the callback: $(page_state)"
for _ in $(seq 1 40); do grep -qE "callback POST .* -> 2[0-9]{2}|gave up|callback skipped" "$MLOG" && break; sleep 0.5; done
sleep 1
echo "mock log after the workflow (${MOCK_FLAGS[*]}), $(( $(date +%s) - T0 )) s after the POST:"; sed 's/^/  | /' "$MLOG"
[ -n "$LOC" ] && echo "/quotes/<id> after the callback: $(page_state)"
if [ -n "${MATRIX_URL:-}" ]; then
  MATRIX_URL=${MATRIX_URL//\{id\}/${LOC##*/}}   # {id} -> id of the quote created above
  echo "callback matrix (send-signed-callback.mjs --url $MATRIX_URL, secret via --env-file):"
  node --env-file=.env.local "$REPO/.claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs" --url "$MATRIX_URL" ${MATRIX_ARGS:-} | sed 's/^/  | /'
fi
echo "server log: $(wc -l < "$SLOG" | tr -d ' ') lines; lines with the submitted email / company / description: $(grep -cE "$EMAIL|$COMPANY|SCENARIO-DESC" "$SLOG" || true)"
echo "server log lines mentioning n8n / quote / callback:"; grep -iE "n8n|quote|callback|webhook" "$SLOG" | sed 's/^/  | /' | head -30
} 2>&1 | tee "$OUT/scenario.txt"
