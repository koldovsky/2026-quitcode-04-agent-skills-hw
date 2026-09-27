#!/usr/bin/env bash
# Task A, server-auth-actions: call the updateLeadStatus Server Action directly with a raw POST,
# the way any client can, and check whether lead_0001 (workspace studio-nova) changed.
#   bash docs/evidence/task-a/attack-server-actions.sh <label>   (repo root; builds and starts :3000)
set -euo pipefail
OUT="${ATTACK_OUT:-docs/evidence/task-a/attack-$1.txt}"
LOG=$(mktemp)
npm run build >/dev/null 2>&1
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/server.sh"
start_server "$LOG"
trap 'stop_server; rm -f "$LOG"' EXIT

# Action id of updateLeadStatus from the build's server reference manifest.
ID=$(node -e '
const m = require("./.next/server/server-reference-manifest.json");
for (const [id, v] of Object.entries(m.node)) if (v.exportedName === "updateLeadStatus") { console.log(id); break; }')
status() { # current status of lead_0001 as seen by its own workspace owner
  curl -s -b "leaddesk_session=demo-u_olena" http://localhost:3000/dashboard/leads/lead_0001 |
    grep -oE '(Новий|Контакт|Кваліфікований|Угода|Втрачений)</span>' | head -1 | sed 's#</span>##'
}
call() { # $1 = cookie header value or empty, $2 = status to set, $3 = path to POST to
  curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000${3:-/dashboard/leads/lead_0001}" \
    -H "Next-Action: $ID" -H "Content-Type: text/plain;charset=UTF-8" -H "Accept: text/x-component" \
    ${1:+-H "Cookie: $1"} --data "[\"lead_0001\",\"$2\"]"
}
# Exit code: 0 = protected (forbidden POSTs change nothing, the owner's POST works), 1 = not.
FAILED=0
expect() { # $1 description, $2 expected status, $3 actual status
  if [ "$2" = "$3" ]; then echo "  ok   $1: status $3"; else echo "  FAIL $1: expected status $2, got $3"; FAILED=1; fi
}
{
  echo "# $1 · $(git rev-parse --short HEAD) · build $BUILD_ID · pid $SERVER_PID · action id ${ID:0:12}…"
  BEFORE=$(status)
  echo "status before:                          $BEFORE"
  echo "POST without cookie -> lost:            HTTP $(call '' lost) · status now: $(status)"
  expect "no cookie" "$BEFORE" "$(status)"
  echo "POST without cookie to / (no proxy) -> lost: HTTP $(call '' lost /) · status now: $(status)"
  expect "no cookie, via /" "$BEFORE" "$(status)"
  echo "POST as marta (brightline) -> won:      HTTP $(call 'leaddesk_session=demo-u_marta' won) · status now: $(status)"
  expect "other workspace (marta)" "$BEFORE" "$(status)"
  echo "POST as olena (owner) -> contacted:     HTTP $(call 'leaddesk_session=demo-u_olena' contacted) · status now: $(status)"
  expect "owner (olena)" "Контакт" "$(status)"
  [ "$FAILED" = 0 ] && echo "result: protected (exit 0)" || echo "result: NOT protected (exit 1)"
} | tee "$OUT"
grep -q "^result: protected" "$OUT"
