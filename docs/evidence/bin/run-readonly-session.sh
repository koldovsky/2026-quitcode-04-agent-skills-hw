#!/usr/bin/env bash
# One fresh, READ-ONLY headless Claude Code session with a full transcript.
#   bash docs/evidence/bin/run-readonly-session.sh <out-dir> <work-dir> <prompt-file>
# The agent can only look: Skill, Read, Grep, Glob. Edit/Write/NotebookEdit/Bash are removed with
# --disallowedTools (a real ban, unlike --allowedTools). Default permission mode, no bypass.
# Project settings only (no personal skills, no user hooks), no MCP servers, same model and effort.
set -uo pipefail
OUT=$(mkdir -p "$1" && cd "$1" && pwd); WORK=$(cd "$2" && pwd)
PROMPT=$(cd "$(dirname "$3")" && pwd)/$(basename "$3")
MODEL=${MODEL:-opus}; EFFORT=${EFFORT:-high}
{
  echo "claude: $(claude --version)"
  echo "model: $MODEL · effort: $EFFORT"
  echo "prompt sha256: $(shasum -a 256 "$PROMPT" | cut -d' ' -f1)"
  echo "flags: --setting-sources project --strict-mcp-config --allowedTools Skill,Read,Grep,Glob --disallowedTools Edit,Write,NotebookEdit,Bash"
  echo "started: $(date -u +%FT%TZ)"
} > "$OUT/meta.txt"
START=$(date +%s)
(cd "$WORK" && claude -p --model "$MODEL" --effort "$EFFORT" \
  --output-format stream-json --verbose \
  --setting-sources project --strict-mcp-config \
  --allowedTools "Skill,Read,Grep,Glob" \
  --disallowedTools "Edit,Write,NotebookEdit,Bash" \
  < "$PROMPT" > "$OUT/transcript.jsonl" 2> "$OUT/stderr.txt")
echo "exit: $? · wall: $(( $(date +%s) - START ))s" >> "$OUT/meta.txt"
cat "$OUT/meta.txt"
