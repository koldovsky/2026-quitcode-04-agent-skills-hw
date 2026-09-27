#!/usr/bin/env bash
# usage: bash <repo>/docs/evidence/task-b/nojs-isolation.sh <label>   (cwd = a worktree with the variant to test)
# Builds and starts the worktree, GETs the lead page and replays its note form without JS.
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/server.sh"   # from this repo, not from a temp copy
npm run build >/dev/null 2>&1 || { echo "$1: BUILD FAILED"; exit 1; }
LOG=$(mktemp)
start_server "$LOG"
trap 'stop_server; rm -f "$LOG"' EXIT
H=$(mktemp); curl -s -b leaddesk_session=demo-u_olena http://localhost:3000/dashboard/leads/lead_0001 > $H
ARGS=(); while IFS= read -r l; do ARGS+=(--form-string "$l"); done < <(node -e '
const html=require("fs").readFileSync(process.argv[1],"utf8");const i=html.indexOf("name=\"note\"");
const f=html.slice(html.lastIndexOf("<form",i),i);
for(const m of f.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g))console.log(m[1]+"="+(m[2]??"").replace(/&quot;/g,"\"").replace(/&amp;/g,"&"))' $H)
echo "$1: hidden=${#ARGS[@]}/2 $(curl -s --max-time 10 -o /dev/null -w 'HTTP %{http_code} %{time_total}s' -b leaddesk_session=demo-u_olena -X POST http://localhost:3000/dashboard/leads/lead_0001 "${ARGS[@]}" --form-string "leadId=lead_0001" --form-string "note=  ")"
