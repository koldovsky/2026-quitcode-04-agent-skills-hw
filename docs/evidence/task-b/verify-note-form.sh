#!/usr/bin/env bash
# Task B: the Verify items of building-client-form, checked against the note form from run-1.
#   bash docs/evidence/task-b/verify-note-form.sh   (cwd = checkout with the note form; builds and starts :3000)
# Exit code 1 if any Verify item does not hold (each line says ok / FAIL); VERIFY_OUT overrides the output file.
# "Without JavaScript" is emulated the way a browser without JS submits: the <form> from the server
# HTML (with React's hidden $ACTION_* inputs for the bound action) posted as multipart, no Next-Action header.
set -euo pipefail
OUT=${VERIFY_OUT:-docs/evidence/task-b/run-2/verify.txt}
LOG=$(mktemp); PAGE=$(mktemp)
npm run build >/dev/null 2>&1
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/server.sh"
start_server "$LOG"
trap 'stop_server; rm -f "$LOG" "$PAGE" "$BODY"' EXIT
U=http://localhost:3000/dashboard/leads/lead_0001
OLENA="leaddesk_session=demo-u_olena"; MARTA="leaddesk_session=demo-u_marta"
notes() { curl -s -b "$OLENA" "$U" | { grep -o -- "$1" || true; } | wc -l | tr -d ' '; }

# Hidden inputs React rendered into the note form (progressive enhancement of the bound action).
curl -s -b "$OLENA" "$U" > "$PAGE"
ARGS=()
while IFS= read -r l; do ARGS+=(--form-string "$l"); done < <(node -e '
const html = require("fs").readFileSync(process.argv[1], "utf8");
const i = html.indexOf("name=\"note\"");
const form = html.slice(html.lastIndexOf("<form", i), i);
for (const m of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g))
  console.log(`${m[1]}=${(m[2] ?? "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&")}`);' "$PAGE")
BODY=$(mktemp)
nojs() { # $1 cookie, $2 note text -> HTTP code (000 on timeout, which is then a FAIL); response HTML in $BODY
  curl -s --max-time 15 -o "$BODY" -w "%{http_code}" -b "$1" -X POST "$U" "${ARGS[@]}" --form-string "note=$2" || true
}
has() { { grep -c -- "$1" "$BODY" || true; } | tr -d ' '; }
FAILED=0
check() { # $1 description, $2 condition result (0 = holds), $3 what was seen
  if [ "$2" = 0 ]; then echo "  ok   $1 ($3)"; else echo "  FAIL $1 ($3)"; FAILED=1; fi
}
{
  echo "# Task B verify · $(git rev-parse --short HEAD)$(git diff --quiet -- app components lib || echo +dirty) · build $BUILD_ID · pid $SERVER_PID · $(date -u +%FT%TZ)"
  NAMES=""; for a in "${ARGS[@]}"; do [ "$a" != "--form-string" ] && NAMES="$NAMES ${a%%=*}"; done
  echo "hidden inputs in the server-rendered note form: $(( ${#ARGS[@]} / 2 )) —$NAMES"
  code=$(nojs "$OLENA" 'VERIFY-NOJS-1'); n=$(notes VERIFY-NOJS-1)
  check "no-JS POST as owner saves the note" $([ "$code" = 200 ] && [ "$n" -ge 1 ]; echo $?) "HTTP $code · note on page: $n"
  code=$(nojs "$MARTA" 'VERIFY-MARTA'); n=$(notes VERIFY-MARTA)
  check "no-JS POST as marta (other workspace) is refused" $([ "$code" = 404 ] && [ "$n" = 0 ]; echo $?) "HTTP $code · note on page: $n"
  code=$(nojs '' 'VERIFY-ANON'); n=$(notes VERIFY-ANON)
  check "no-JS POST without cookie is refused" $([ "$code" = 307 ] && [ "$n" = 0 ]; echo $?) "HTTP $code · note on page: $n"
  code=$(nojs "$OLENA" '   '); ai=$(has 'aria-invalid="true"'); ra=$(has 'role="alert"'); msg=$(has 'Напишіть текст нотатки')
  check "empty note: accessible field error" $([ "$code" = 200 ] && [ "$ai" -ge 1 ] && [ "$ra" -ge 1 ] && [ "$msg" -ge 1 ]; echo $?) "HTTP $code · aria-invalid=true: $ai · role=alert: $ra · 'Напишіть текст нотатки': $msg"
  LONG=$(printf 'x%.0s' $(seq 1 501))
  code=$(nojs "$OLENA" "$LONG"); err=$(has 'Не більше 500'); kept=$(has ">$LONG</textarea>"); saved=$(notes "$LONG")
  check "501 chars: error, typed text kept, nothing saved" $([ "$code" = 200 ] && [ "$err" -ge 1 ] && [ "$kept" -ge 1 ] && [ "$saved" = 0 ]; echo $?) "HTTP $code · 'Не більше 500': $err · kept in textarea: $kept · saved: $saved"
  pii=$(grep -cE 'VERIFY-|@|\+380' "$LOG" || true)
  check "server log has no note text, email or phone" $([ "$pii" = 0 ]; echo $?) "matching lines: $pii of $(wc -l < "$LOG" | tr -d ' ')"
  [ "$FAILED" = 0 ] && echo "result: all Verify items hold (exit 0)" || echo "result: some Verify items FAIL (exit 1)"
} | tee "$OUT"
grep -q "^result: all Verify items hold" "$OUT"
