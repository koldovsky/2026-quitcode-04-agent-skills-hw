#!/usr/bin/env bash
# One fresh headless Claude Code session for a Task D A/B run, inside one copy of the project.
#   bash docs/evidence/bin/run-ab-session.sh <out-dir> <copy-dir> <prompt-file> [<session-id to resume>]
# Same as run-scoped-session.sh (acceptEdits, narrow Bash allowlist, no prompts, project settings only,
# no MCP, no network tools), plus: reading anything under ~/Desktop (the working repo, the team brief,
# the mock, the knowledge base), ~/.claude (other sessions' transcripts) and the temp dirs is denied.
# The copies live in ~/leaddesk-ab/ so that this deny does not cover them. Both arms get these exact flags.
# The 4th argument resumes a session that stopped with a question; the answer is always the same text.
set -uo pipefail
OUT=$(mkdir -p "$1" && cd "$1" && pwd); WORK=$(cd "$2" && pwd)
PROMPT=$(cd "$(dirname "$3")" && pwd)/$(basename "$3"); RESUME=${4:-}
MODEL=${MODEL:-opus}; EFFORT=${EFFORT:-high}
ALLOW="Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*)"
# ALLOW_EXTRA (unset for runs a1, a2, b1, b2): more allow rules, the same for both arms of a pair. Pair a3/b3 adds
# the argument forms a2 was refused (`npm run lint --prefix …`, `npx tsc --noEmit -p …`).
ALLOW="$ALLOW${ALLOW_EXTRA:+,$ALLOW_EXTRA}"
DENY="WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)"
TAG=${RESUME:+-resume}
{
  echo "claude: $(claude --version)"
  echo "model: $MODEL · effort: $EFFORT · cwd: $WORK"
  echo "prompt sha256: $(shasum -a 256 "$PROMPT" | cut -d' ' -f1)${RESUME:+ · resume $RESUME}"
  echo "flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools $ALLOW --disallowedTools $DENY"
  echo "started: $(date -u +%FT%TZ)"
} > "$OUT/meta$TAG.txt"
START=$(date +%s)
(cd "$WORK" && claude -p --model "$MODEL" --effort "$EFFORT" \
  --output-format stream-json --verbose \
  --setting-sources project --strict-mcp-config \
  --permission-mode acceptEdits --permission-prompts none \
  --allowedTools "$ALLOW" --disallowedTools "$DENY" \
  ${RESUME:+--resume "$RESUME"} \
  < "$PROMPT" > "$OUT/transcript$TAG.jsonl" 2> "$OUT/stderr$TAG.txt")
echo "exit: $? · wall: $(( $(date +%s) - START ))s" >> "$OUT/meta$TAG.txt"
cat "$OUT/meta$TAG.txt"
