#!/usr/bin/env bash
# One fresh headless Claude Code session that may EDIT files in the work dir, with a narrow allowlist.
#   bash docs/evidence/bin/run-scoped-session.sh <out-dir> <work-dir> <prompt-file>
# No bypassPermissions: permission mode acceptEdits (edits inside the work dir only), Bash limited to
# the allowlist below, anything else that would need a prompt is denied (--permission-prompts none).
# Network tools are removed. Project settings only, no MCP, same model and effort as every other run.
set -uo pipefail
OUT=$(mkdir -p "$1" && cd "$1" && pwd); WORK=$(cd "$2" && pwd)
PROMPT=$(cd "$(dirname "$3")" && pwd)/$(basename "$3")
MODEL=${MODEL:-opus}; EFFORT=${EFFORT:-high}
ALLOW="Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*)"
DENY="WebFetch,WebSearch,NotebookEdit"
{
  echo "claude: $(claude --version)"
  echo "model: $MODEL · effort: $EFFORT"
  echo "prompt sha256: $(shasum -a 256 "$PROMPT" | cut -d' ' -f1)"
  echo "flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools $ALLOW --disallowedTools $DENY"
  echo "started: $(date -u +%FT%TZ)"
} > "$OUT/meta.txt"
START=$(date +%s)
(cd "$WORK" && claude -p --model "$MODEL" --effort "$EFFORT" \
  --output-format stream-json --verbose \
  --setting-sources project --strict-mcp-config \
  --permission-mode acceptEdits --permission-prompts none \
  --allowedTools "$ALLOW" --disallowedTools "$DENY" \
  < "$PROMPT" > "$OUT/transcript.jsonl" 2> "$OUT/stderr.txt")
echo "exit: $? · wall: $(( $(date +%s) - START ))s" >> "$OUT/meta.txt"
cat "$OUT/meta.txt"
