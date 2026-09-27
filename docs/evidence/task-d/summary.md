# Evidence: task-d

Packed by `docs/evidence/bin/pack-evidence.mjs`. Each section is one original file; the originals (and raw `transcript.jsonl`) are in `docs/evidence/raw-evidence.tar.gz`.

## `task-d/baseline-a1.txt`

```text
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/leaddesk-ab/leaddesk-ab-a1; echo "exit=$?"   # до прогону, увесь код
check-contract · root ~/leaddesk-ab/leaddesk-ab-a1 · full
n8n callers: app/actions.ts · callback routes: -
C1   FAIL no test webhook URL (/webhook-test/) in code or .env.example
       .env.example:6  test webhook URL
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   FAIL requests to n8n only from lib/n8n/client.ts
       app/actions.ts:55  fetch to n8n outside lib/n8n/client.ts
       app/actions.ts:55  N8N_WEBHOOK_* read outside lib/n8n/client.ts
C4   FAIL the module that calls n8n starts with import "server-only"
       app/actions.ts:1  first statement is not import "server-only"
C5   FAIL every fetch to n8n has signal: AbortSignal.timeout(...)
       app/actions.ts:55  fetch without AbortSignal.timeout
C6   FAIL requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
       app/actions.ts:55  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL request body is the envelope { version: 1, event, data }
       app/actions.ts:55  body is not the { version: 1, event, data } envelope
C8   FAIL a Server Action that triggers n8n does it inside after()
       app/actions.ts:55  Server Action waits for n8n: no after()
C9   N/A  callback route reads the raw body; no request.json(), no JSON.parse before the signature check
C10  N/A  callback signature: HMAC + length check + timingSafeEqual, never ===
C11  N/A  callback timestamp checked against a 300 s window
C12  N/A  callback idempotency-key read and bound to data.jobId of the signed body
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  FAIL .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
       .env.example:1  N8N_WEBHOOK_BASE_URL is missing
       .env.example:1  N8N_WEBHOOK_TOKEN is missing
       .env.example:1  N8N_CALLBACK_SECRET is missing
       .env.example:1  APP_BASE_URL is missing
Summary: 3 PASS, 8 FAIL, 4 N/A
exit=1
```

## `task-d/baseline-b1.txt`

```text
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/leaddesk-ab/leaddesk-ab-b1; echo "exit=$?"   # до прогону, увесь код
check-contract · root ~/leaddesk-ab/leaddesk-ab-b1 · full
n8n callers: app/actions.ts · callback routes: -
C1   FAIL no test webhook URL (/webhook-test/) in code or .env.example
       .env.example:6  test webhook URL
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   FAIL requests to n8n only from lib/n8n/client.ts
       app/actions.ts:55  fetch to n8n outside lib/n8n/client.ts
       app/actions.ts:55  N8N_WEBHOOK_* read outside lib/n8n/client.ts
C4   FAIL the module that calls n8n starts with import "server-only"
       app/actions.ts:1  first statement is not import "server-only"
C5   FAIL every fetch to n8n has signal: AbortSignal.timeout(...)
       app/actions.ts:55  fetch without AbortSignal.timeout
C6   FAIL requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
       app/actions.ts:55  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL request body is the envelope { version: 1, event, data }
       app/actions.ts:55  body is not the { version: 1, event, data } envelope
C8   FAIL a Server Action that triggers n8n does it inside after()
       app/actions.ts:55  Server Action waits for n8n: no after()
C9   N/A  callback route reads the raw body; no request.json(), no JSON.parse before the signature check
C10  N/A  callback signature: HMAC + length check + timingSafeEqual, never ===
C11  N/A  callback timestamp checked against a 300 s window
C12  N/A  callback idempotency-key read and bound to data.jobId of the signed body
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  FAIL .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
       .env.example:1  N8N_WEBHOOK_BASE_URL is missing
       .env.example:1  N8N_WEBHOOK_TOKEN is missing
       .env.example:1  N8N_CALLBACK_SECRET is missing
       .env.example:1  APP_BASE_URL is missing
Summary: 3 PASS, 8 FAIL, 4 N/A
exit=1
```

## `task-d/context-a1.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 24k / 1m (2%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.2% |
| System tools | 18.1k | 1.8% |
| System tools (deferred) | 19.5k | 1.9% |
| Memory files | 1.5k | 0.1% |
| Skills | 2.3k | 0.2% |
| Messages | 10 | 0.0% |
| Free space | 943k | 94.3% |
| Autocompact buffer | 33k | 3.3% |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| Project | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a1/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a1/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| dataviz | Built-in | ~480 |
| artifact-design | Built-in | ~70 |
| artifact-diagramming | Built-in | ~70 |
| artifact-capabilities | Built-in | ~220 |
| update-config | Built-in | ~240 |
| keybindings-help | Built-in | ~80 |
| code-review | Built-in | ~170 |
| simplify | Built-in | ~60 |
| fewer-permission-prompts | Built-in | ~60 |
| loop | Built-in | ~120 |
| schedule | Built-in | ~130 |
| claude-api | Built-in | ~360 |
| workflow-authoring | Built-in | ~80 |
| run | Built-in | ~120 |
| init | Built-in | ~20 |
| security-review | Built-in | ~30 |

```

## `task-d/context-a2.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 24k / 1m (2%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.2% |
| System tools | 18.1k | 1.8% |
| System tools (deferred) | 19.5k | 1.9% |
| Memory files | 1.5k | 0.1% |
| Skills | 2.3k | 0.2% |
| Messages | 10 | 0.0% |
| Free space | 943k | 94.3% |
| Autocompact buffer | 33k | 3.3% |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| Project | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a2/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a2/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| dataviz | Built-in | ~480 |
| artifact-design | Built-in | ~70 |
| artifact-diagramming | Built-in | ~70 |
| artifact-capabilities | Built-in | ~220 |
| update-config | Built-in | ~240 |
| keybindings-help | Built-in | ~80 |
| code-review | Built-in | ~170 |
| simplify | Built-in | ~60 |
| fewer-permission-prompts | Built-in | ~60 |
| loop | Built-in | ~120 |
| schedule | Built-in | ~130 |
| claude-api | Built-in | ~360 |
| workflow-authoring | Built-in | ~80 |
| run | Built-in | ~120 |
| init | Built-in | ~20 |
| security-review | Built-in | ~30 |

```

## `task-d/context-b1.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 24k / 1m (2%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.2% |
| System tools | 17.8k | 1.8% |
| System tools (deferred) | 19.5k | 1.9% |
| Memory files | 1.5k | 0.1% |
| Skills | 2.6k | 0.3% |
| Messages | 10 | 0.0% |
| Free space | 943k | 94.3% |
| Autocompact buffer | 33k | 3.3% |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| Project | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b1/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b1/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| integrating-n8n-webhooks | Project | ~340 |
| dataviz | Built-in | ~480 |
| artifact-design | Built-in | ~70 |
| artifact-diagramming | Built-in | ~70 |
| artifact-capabilities | Built-in | ~220 |
| update-config | Built-in | ~240 |
| keybindings-help | Built-in | ~80 |
| code-review | Built-in | ~170 |
| simplify | Built-in | ~60 |
| fewer-permission-prompts | Built-in | ~60 |
| loop | Built-in | ~120 |
| schedule | Built-in | ~130 |
| claude-api | Built-in | ~360 |
| workflow-authoring | Built-in | ~80 |
| run | Built-in | ~120 |
| init | Built-in | ~20 |
| security-review | Built-in | ~30 |

```

## `task-d/context-b2.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 24k / 1m (2%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.2% |
| System tools | 17.8k | 1.8% |
| System tools (deferred) | 19.5k | 1.9% |
| Memory files | 1.5k | 0.1% |
| Skills | 2.6k | 0.3% |
| Messages | 10 | 0.0% |
| Free space | 943k | 94.3% |
| Autocompact buffer | 33k | 3.3% |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| Project | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b2/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b2/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| integrating-n8n-webhooks | Project | ~340 |
| dataviz | Built-in | ~480 |
| artifact-design | Built-in | ~70 |
| artifact-diagramming | Built-in | ~70 |
| artifact-capabilities | Built-in | ~220 |
| update-config | Built-in | ~240 |
| keybindings-help | Built-in | ~80 |
| code-review | Built-in | ~170 |
| simplify | Built-in | ~60 |
| fewer-permission-prompts | Built-in | ~60 |
| loop | Built-in | ~120 |
| schedule | Built-in | ~130 |
| claude-api | Built-in | ~360 |
| workflow-authoring | Built-in | ~80 |
| run | Built-in | ~120 |
| init | Built-in | ~20 |
| security-review | Built-in | ~30 |

```

## `task-d/isolation.txt`

```text
# BASE 898aa2b · копії в ~/leaddesk-ab/leaddesk-ab-{a1,a2,b1,b2}
$ git -C leaddesk-ab-a1 log --oneline --decorate
9b151f1 (HEAD -> main, tag: base) start
$ git -C leaddesk-ab-a2 log --oneline --decorate
e4e3251 (HEAD -> main, tag: base) start
$ git -C leaddesk-ab-b1 log --oneline --decorate
18bed3a (HEAD -> main, tag: base) start
$ git -C leaddesk-ab-b2 log --oneline --decorate
fb2f813 (HEAD -> main, tag: base) start
$ find leaddesk-ab-* -name SKILL.md -not -path "*/node_modules/*"
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/SKILL.md
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/SKILL.md
$ ls -A leaddesk-ab-* | grep -xE "tools|materials|docs|README.md|.coderabbit.yaml|.github" || echo "no hints - ok"
no hints - ok
$ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" leaddesk-ab-a1 --exclude-dir=node_modules || echo "no contract - ok"
no contract - ok
$ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" leaddesk-ab-a2 --exclude-dir=node_modules || echo "no contract - ok"
no contract - ok
$ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" leaddesk-ab-b1 --exclude-dir=node_modules  # B: лише файли скіла
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/references/response-modes.md
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/references/contract.md
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/references/code-templates.md
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/references/n8n-setup.md
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/scripts/selftest-check-contract.mjs
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs
leaddesk-ab-b1/.claude/skills/integrating-n8n-webhooks/SKILL.md
$ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" leaddesk-ab-b2 --exclude-dir=node_modules  # B: лише файли скіла
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/references/response-modes.md
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/references/contract.md
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/references/code-templates.md
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/references/n8n-setup.md
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/scripts/selftest-check-contract.mjs
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs
leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/SKILL.md
$ grep -rliE "n8n" leaddesk-ab-a1 --exclude-dir=node_modules --exclude-dir=.git
leaddesk-ab-a1/app/actions.ts
leaddesk-ab-a1/.env.example
$ diff -rq leaddesk-ab-a1 leaddesk-ab-b1 -x node_modules -x .git
Only in leaddesk-ab-b1: .claude
$ grep -rlE "x-n8n-token|timingSafeEqual" leaddesk-ab-a1/node_modules --include=*.md -l | head
(docs next: 0 файлів з 'n8n')
```

## `task-d/prompt.txt`

```text
У n8n клієнта є опублікований воркфлоу `quote-request`: він готує PDF-кошторис і
працює від 40 до 90 секунд. Додай сторінку `/quotes/new` з формою запиту на
кошторис (компанія, email, опис задачі, бюджет) і Server Action, який запускає цей
воркфлоу. Додай ендпоінт, який n8n викличе, коли кошторис буде готовий, і показуй
статус запиту на сторінці `/quotes/[id]`.
```

## `task-d/run-a1.launch.log`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high · cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a1
prompt sha256: 498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*) --disallowedTools WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)
started: 2026-09-27T13:58:28Z
exit: 1 · wall: 282s
```

## `task-d/run-a2.launch.log`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high · cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a2
prompt sha256: 498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*) --disallowedTools WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)
started: 2026-09-27T13:58:28Z
exit: 0 · wall: 293s
```

## `task-d/run-b1.launch.log`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high · cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b1
prompt sha256: 498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*) --disallowedTools WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)
started: 2026-09-27T13:58:28Z
exit: 0 · wall: 227s
```

## `task-d/run-b2.launch.log`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high · cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-b2
prompt sha256: 498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*) --disallowedTools WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)
started: 2026-09-27T13:58:28Z
exit: 0 · wall: 241s
```
