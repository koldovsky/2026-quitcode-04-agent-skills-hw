# Sourced by the measurement scripts. Starts `next start` on :3000 from the current build and
# guarantees that the process answering on :3000 is the one this script started.
#   start_server <log>   ·   stop_server
start_server() {
  if lsof -t -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ABORT: port 3000 is already taken by pid $(lsof -t -iTCP:3000 -sTCP:LISTEN) — a stale server would be measured" >&2
    exit 3
  fi
  ./node_modules/.bin/next start -p 3000 >"$1" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do curl -s -o /dev/null localhost:3000 && break; sleep 0.2; done
  local owner; owner=$(lsof -t -iTCP:3000 -sTCP:LISTEN | head -1)
  [ "$owner" = "$SERVER_PID" ] || { echo "ABORT: :3000 owned by $owner, started $SERVER_PID" >&2; exit 3; }
  BUILD_ID=$(cat .next/BUILD_ID)
}
stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  for _ in $(seq 1 25); do lsof -t -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 || return 0; sleep 0.2; done
  # force-kill only our own server: if another process took the port meanwhile, leave it alone
  local owner; owner=$(lsof -t -iTCP:3000 -sTCP:LISTEN | head -1)
  if [ "$owner" = "$SERVER_PID" ]; then kill -9 "$SERVER_PID" 2>/dev/null || true
  elif [ -n "$owner" ]; then echo "stop_server: :3000 is now owned by pid $owner, not $SERVER_PID — not killing it" >&2; fi
}
