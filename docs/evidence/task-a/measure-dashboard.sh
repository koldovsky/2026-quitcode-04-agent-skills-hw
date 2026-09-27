#!/usr/bin/env bash
# Task A: one measurement of /dashboard on a production build.
# Usage (repo root): bash docs/evidence/task-a/measure-dashboard.sh <label>
# Builds, starts `next start` on :3000, measures, stops the server.
# Output: docs/evidence/task-a/<label>.txt
set -euo pipefail
LABEL=${1:?label}
OUT="docs/evidence/task-a/$LABEL.txt"
LOG=$(mktemp)
C="leaddesk_session=demo-u_olena"
U=http://localhost:3000/dashboard

npm run build >/dev/null 2>&1
. docs/evidence/bin/server.sh
start_server "$LOG"
trap 'stop_server; rm -f "$LOG"' EXIT

{
  echo "# $LABEL · $(git rev-parse --short HEAD)$(git diff --quiet -- app components lib || echo +dirty) · build $BUILD_ID · pid $SERVER_PID · $(date -u +%FT%TZ)"
  curl -s -o /dev/null -b "$C" "$U"   # warm-up
  echo "## timing (3 runs)"
  for i in 1 2 3; do
    curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" "$U"
  done

  echo "## db queries for ONE request of /dashboard (console.count delta)"
  snap() { grep -oE 'db:[a-zA-Z]+: [0-9]+' "$LOG" | awk -F': ' '{last[$1]=$2} END{for(k in last) print k, last[k]}' | sort; }
  BEFORE=$(snap)
  curl -s -o /dev/null -b "$C" "$U"; sleep 0.3
  AFTER=$(snap)
  join -a2 -e0 -o 0,1.2,2.2 <(echo "$BEFORE") <(echo "$AFTER") | awk '{d=$3-$2; if(d>0) print $1, d}'

  HTML=$(curl -s -b "$C" "$U")
  echo "## sizes, bytes"
  echo "HTML $(printf %s "$HTML" | wc -c | tr -d ' ')"
  echo "RSC  $(curl -sL -b "$C" -H 'RSC: 1' "$U" | wc -c | tr -d ' ')"

  echo "## lead fields that reach the browser (occurrences in HTML)"
  for f in rawPayload internalNotes ipAddress userAgent acceptLanguage '"phone"'; do
    echo "$f $(printf %s "$HTML" | grep -o "$f" | wc -l | tr -d ' ')"
  done

  echo "## JS loaded by /dashboard on open (scripts in HTML)"
  TOTAL=0; GZ=0; N=0
  for s in $(printf %s "$HTML" | grep -oE '/_next/static/[^"]+\.js' | sort -u); do
    B=$(curl -s "http://localhost:3000$s" | wc -c | tr -d ' ')
    G=$(curl -s "http://localhost:3000$s" | gzip -9 | wc -c | tr -d ' ')
    TOTAL=$((TOTAL+B)); GZ=$((GZ+G)); N=$((N+1))
  done
  echo "scripts $N, raw $TOTAL B, gzip $GZ B"
  echo "## chunks containing exceljs / lodash / recharts markers"
  for s in $(printf %s "$HTML" | grep -oE '/_next/static/[^"]+\.js' | sort -u); do
    body=$(curl -s "http://localhost:3000$s")
    tags=""
    grep -q 'ExcelJS\|exceljs\|xlsx' <<<"$body" && tags="$tags exceljs"
    grep -q 'lodash' <<<"$body" && tags="$tags lodash"
    grep -q 'recharts' <<<"$body" && tags="$tags recharts"
    [ -n "$tags" ] && echo "$s $(wc -c <<<"$body" | tr -d ' ') B:$tags"
  done
  true
} | tee "$OUT"
