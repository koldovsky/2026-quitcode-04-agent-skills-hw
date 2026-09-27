# Evidence: task-a

Packed by `docs/evidence/bin/pack-evidence.mjs`. Each section is one original file; the originals (and raw `transcript.jsonl`) are in `docs/evidence/raw-evidence.tar.gz`.

## `task-a/00-baseline-main.txt`

```text
# 00-baseline-main · 01a7dd4 · build j5UOFtEwloa5kpSJ-ELuY · pid 46485 · 2026-09-27T13:19:38Z
## timing (3 runs)
TTFB 2.219355s, total 2.219667s
TTFB 2.220246s, total 2.220612s
TTFB 2.217306s, total 2.217513s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 3
db:getWorkspace 3
## sizes, bytes
HTML 424592
RSC  315197
## lead fields that reach the browser (occurrences in HTML)
rawPayload 172
internalNotes 172
ipAddress 172
userAgent 344
acceptLanguage 172
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 10, raw 1871692 B, gzip 536006 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/0m6anbet4hr_s.js 1296173 B: exceljs lodash recharts
```

## `task-a/01-async-parallel.txt`

```text
# 01-async-parallel · e289c5d · build X2pJUkKrV7JlimP-SFsxE · pid 46749 · 2026-09-27T13:19:58Z
## timing (3 runs)
TTFB 1.416044s, total 1.416373s
TTFB 1.418761s, total 1.419084s
TTFB 1.413102s, total 1.413385s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 3
db:getWorkspace 3
## sizes, bytes
HTML 424592
RSC  315197
## lead fields that reach the browser (occurrences in HTML)
rawPayload 172
internalNotes 172
ipAddress 172
userAgent 344
acceptLanguage 172
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 10, raw 1871692 B, gzip 536006 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/0m6anbet4hr_s.js 1296173 B: exceljs lodash recharts
```

## `task-a/02-server-cache-react.txt`

```text
# 02-server-cache-react · e84f206 · build _aQCBSnxdCAP7HMmSlaCj · pid 47012 · 2026-09-27T13:20:11Z
## timing (3 runs)
TTFB 1.415265s, total 1.415563s
TTFB 1.417511s, total 1.417780s
TTFB 1.412886s, total 1.413145s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 424592
RSC  315197
## lead fields that reach the browser (occurrences in HTML)
rawPayload 172
internalNotes 172
ipAddress 172
userAgent 344
acceptLanguage 172
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 10, raw 1871692 B, gzip 536006 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/0m6anbet4hr_s.js 1296173 B: exceljs lodash recharts
```

## `task-a/03-server-serialization.txt`

```text
# 03-server-serialization · 281ff34 · build X3VOWp3neyeb0BCwv3U86 · pid 47273 · 2026-09-27T13:20:26Z
## timing (3 runs)
TTFB 1.411499s, total 1.411629s
TTFB 1.416366s, total 1.416637s
TTFB 1.409309s, total 1.409444s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 111377
RSC  31257
## lead fields that reach the browser (occurrences in HTML)
rawPayload 0
internalNotes 0
ipAddress 0
userAgent 0
acceptLanguage 0
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 10, raw 1871692 B, gzip 536006 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/0m6anbet4hr_s.js 1296173 B: exceljs lodash recharts
```

## `task-a/04-bundle-conditional.txt`

```text
# 04-bundle-conditional · 211f8fe · build Wgsgp3AYVm1eG6Jh-UJKB · pid 47536 · 2026-09-27T13:20:40Z
## timing (3 runs)
TTFB 1.415500s, total 1.415592s
TTFB 1.412876s, total 1.413108s
TTFB 1.409907s, total 1.410025s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 111377
RSC  31257
## lead fields that reach the browser (occurrences in HTML)
rawPayload 0
internalNotes 0
ipAddress 0
userAgent 0
acceptLanguage 0
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 10, raw 941001 B, gzip 282121 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/0fe0b9of0kmph.js 365381 B: exceljs recharts
```

## `task-a/05-bundle-dynamic-imports.txt`

```text
# 05-bundle-dynamic-imports · 7a55dd8 · build Wg4WBkvhbeaKbnl4yZpdJ · pid 47798 · 2026-09-27T13:20:55Z
## timing (3 runs)
TTFB 1.412490s, total 1.412605s
TTFB 1.413053s, total 1.413323s
TTFB 1.409616s, total 1.409761s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 111057
RSC  31029
## lead fields that reach the browser (occurrences in HTML)
rawPayload 0
internalNotes 0
ipAddress 0
userAgent 0
acceptLanguage 0
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 9, raw 587212 B, gzip 181271 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/34vu4gm18o5ty.js 12483 B: exceljs
```

## `task-a/06-bundle-barrel-imports.txt`

```text
# 06-bundle-barrel-imports · 035118b · build piG75uX_smcYfzxJMwg7x · pid 48047 · 2026-09-27T13:21:09Z
## timing (3 runs)
TTFB 1.412231s, total 1.412369s
TTFB 1.411785s, total 1.412020s
TTFB 1.409859s, total 1.410074s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 111057
RSC  31029
## lead fields that reach the browser (occurrences in HTML)
rawPayload 0
internalNotes 0
ipAddress 0
userAgent 0
acceptLanguage 0
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 9, raw 587212 B, gzip 181271 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/34vu4gm18o5ty.js 12483 B: exceljs
```

## `task-a/07-async-suspense-boundaries.txt`

```text
# 07-async-suspense-boundaries · 3d3cf84 · build 0UZUIOhCmBzHQmrDB34u1 · pid 48297 · 2026-09-27T13:21:22Z
## timing (3 runs)
TTFB 0.611640s, total 1.407296s
TTFB 0.613363s, total 1.406939s
TTFB 0.610092s, total 1.405991s
## db queries for ONE request of /dashboard (console.count delta)
db:getLeadStats 1
db:getLeads 1
db:getSourceBreakdown 1
db:getUserBySession 1
db:getWorkspace 1
## sizes, bytes
HTML 113238
RSC  31627
## lead fields that reach the browser (occurrences in HTML)
rawPayload 0
internalNotes 0
ipAddress 0
userAgent 0
acceptLanguage 0
"phone" 0
## JS loaded by /dashboard on open (scripts in HTML)
scripts 9, raw 587212 B, gzip 181271 B
## chunks containing exceljs / lodash / recharts markers
/_next/static/chunks/34vu4gm18o5ty.js 12483 B: exceljs
```

## `task-a/attack-after.txt`

```text
# after · 01464c9 · build uaZm7BSDlgTF1Xu2mPu3B · pid 49212 · action id 604630c47f7a…
status before:                          Кваліфікований
POST without cookie -> lost:            HTTP 307 · status now: Кваліфікований
POST without cookie to / (no proxy) -> lost: HTTP 200 · status now: Кваліфікований
POST as marta (brightline) -> won:      HTTP 500 · status now: Кваліфікований
POST as olena (owner) -> contacted:     HTTP 200 · status now: Контакт
```

## `task-a/attack-before.txt`

```text
# before · 77882b5 · build G5lEQ05fkNyb98ljuxCeB · pid 49102 · action id 604630c47f7a…
status before:                          Кваліфікований
POST without cookie -> lost:            HTTP 307 · status now: Кваліфікований
POST without cookie to / (no proxy) -> lost: HTTP 200 · status now: Кваліфікований
POST as marta (brightline) -> won:      HTTP 200 · status now: Угода
POST as olena (owner) -> contacted:     HTTP 200 · status now: Контакт
```

## `task-a/context-after-install.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 25.1k / 500k (5%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.4% |
| System tools | 13.8k | 2.8% |
| MCP tools | 636 | 0.1% |
| MCP tools (deferred) | 7.2k | 1.4% |
| System tools (deferred) | 19.6k | 3.9% |
| Custom agents | 83 | 0.0% |
| Memory files | 1.8k | 0.4% |
| Skills | 6.7k | 1.3% |
| Messages | 10 | 0.0% |
| Free space | 441.9k | 88.4% |
| Autocompact buffer | 33k | 6.6% |

### MCP Tools

| Tool | Server | Tokens |
|------|--------|--------|
| mcp__claude_ai_Claude_Docs__batch | claude_ai_Claude_Docs | 156 |
| mcp__claude_ai_Claude_Docs__create | claude_ai_Claude_Docs | 242 |
| mcp__claude_ai_Claude_Docs__delete | claude_ai_Claude_Docs | 325 |
| mcp__claude_ai_Claude_Docs__export | claude_ai_Claude_Docs | 308 |
| mcp__claude_ai_Claude_Docs__guide | claude_ai_Claude_Docs | 198 |
| mcp__claude_ai_Claude_Docs__query | claude_ai_Claude_Docs | 172 |
| mcp__claude_ai_Claude_Docs__read | claude_ai_Claude_Docs | 308 |
| mcp__claude_ai_Claude_Docs__update | claude_ai_Claude_Docs | 282 |
| mcp__drawio__get_page | drawio | 250 |
| mcp__drawio__list_pages | drawio | 209 |
| mcp__drawio__open_drawio_csv | drawio | 257 |
| mcp__drawio__open_drawio_mermaid | drawio | 1.3k |
| mcp__drawio__open_drawio_xml | drawio | 1.7k |
| mcp__drawio__search_shapes | drawio | 501 |
| mcp__drawio__set_page | drawio | 351 |
| mcp__semble__find_related | semble | 614 |
| mcp__semble__search | semble | 647 |

### Custom Agents

| Agent Type | Source | Tokens |
|------------|--------|--------|
| semble-search | User | 83 |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| User | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| User | /Users/hryhorii_haponiuk/.claude/RTK.md | 371 |
| Project | /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| api-and-interface-design | User | ~90 |
| banner-design | User | ~170 |
| brand | User | ~60 |
| code-simplification | User | ~90 |
| design | User | ~210 |
| design-system | User | ~100 |
| drawio-skill | User | ~260 |
| interface-design | User | ~140 |
| security-and-hardening | User | ~90 |
| slides | User | ~50 |
| supabase | User | ~170 |
| supabase-postgres-best-practices | User | ~290 |
| ui-styling | User | ~170 |
| ui-ux-pro-max | User | ~160 |
| vercel-react-best-practices | Project | ~120 |
| drawio:drawio | Plugin (drawio) | ~100 |
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
| docs | claude.ai sync | ~330 |
| docx | claude.ai sync | ~320 |
| google-workspace | claude.ai sync | ~330 |
| import-memory | claude.ai sync | ~60 |
| morning | claude.ai sync | ~120 |
| pdf | claude.ai sync | ~150 |
| pptx | claude.ai sync | ~330 |
| skill-creator | claude.ai sync | ~120 |
| xlsx | claude.ai sync | ~320 |

```

## `task-a/context-project-only.txt`

```text
## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 24k / 1m (2%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.1k | 0.2% |
| System tools | 18k | 1.8% |
| System tools (deferred) | 19.5k | 1.9% |
| Memory files | 1.5k | 0.1% |
| Skills | 2.4k | 0.2% |
| Messages | 10 | 0.0% |
| Free space | 943k | 94.3% |
| Autocompact buffer | 33k | 3.3% |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| Project | /Users/hryhorii_haponiuk/.claude/CLAUDE.md | 687 |
| Project | /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/CLAUDE.md | 16 |
| Project | /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/AGENTS.md | 771 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| vercel-react-best-practices | Project | ~120 |
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

## `task-a/install.txt`

```text
│
●   claude-code_2-1-281_agent  Agent detected — installing non-interactively
[?25l│
◇  Source: https://github.com/vercel-labs/agent-skills.git @ agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278
[?25h[?25l│
◒  Cloning repository…[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository…[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository….[1G[J◐  Cloning repository….[1G[J◓  Cloning repository….[1G[J◑  Cloning repository….[1G[J◒  Cloning repository….[1G[J◇  Repository cloned
[?25h[?25l│
[1G[J◇  Found 9 skills
[?25h│
●  Selected 1 skill: vercel-react-best-practices
│
◇  Installation Summary ───────────────────────────────────────────────────────╮
│                                                                              │
│  ~/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/.age  │
│  nts/skills/vercel-react-best-practices                                      │
│    copy → Claude Code                                                        │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────╯
[?25l│
[1G[J◇  Installation complete
[?25h
│
◇  Installed 1 skill ──────────────────────────────────────────────────────────╮
│                                                                              │
│  ✓ vercel-react-best-practices (copied)                                      │
│    → ~/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw/  │
│  .claude/skills/vercel-react-best-practices                                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────╯
│
└  Done!  Review skills before use; they run with full agent permissions.
```

## `task-a/smoke-browser.txt`

```text
# Browser smoke test after all Task A fixes · 3d3cf84 · 2026-09-27 · production build (next start)
# In-app browser (Claude desktop), user Olena via demo login.
/dashboard: 5 stats cards rendered [172, 51, 14, 73%, 3 289 USD]; table rows 172; JS resources on open 9
"Показати графік джерел": 6 recharts bars; JS resources 9 -> 10 (chart chunk loaded on click)
"Експорт в Excel": blob 18704 B, type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
  download name leads-2026-09-27.xlsx; JS resources 10 -> 11 (exceljs chunk loaded on click)
console errors: none
status change as owner: covered by attack-after.txt (olena -> contacted: HTTP 200, status changed)
```

## `task-a/vercel-review/meta.txt`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high
prompt sha256: f99fd15a943c1cb12ecc5a0b95dead3f8de4adf2b7eaedec4330f2a61c46740a
flags: --setting-sources project --strict-mcp-config --allowedTools Skill,Read,Grep,Glob --disallowedTools Edit,Write,NotebookEdit,Bash
started: 2026-09-27T13:01:28Z
exit: 0 · wall: 119s
```

## `task-a/vercel-review/prompt.txt`

```text
Зроби рев'ю app/, components/, lib/ за скілом vercel-react-best-practices. Для кожної проблеми — рядок таблиці: файл:рядок | id правила | що не так | виправлення для Next.js 16. Файли не змінюй.
```

## `task-a/vercel-review/stderr.txt`

_(empty file)_

## `task-a/vercel-review/transcript.jsonl`

Raw stream-json transcript, only in `raw-evidence.tar.gz`. Readable form: `transcript.md` of this unit.

## `task-a/attack-after-review-branch.txt`

Після рев'ю CodeRabbit скрипт сам звіряє очікування (exit 1, якщо заборонений POST змінив лід). Прогін на гілці:

```text
# branch · 0b0cea4 · build SV3XoaF0ys7jmkhqXBLO7 · pid 82223 · action id 603a2cb3f503…
status before:                          Кваліфікований
POST without cookie -> lost:            HTTP 307 · status now: Кваліфікований
  ok   no cookie: status Кваліфікований
POST without cookie to / (no proxy) -> lost: HTTP 200 · status now: Кваліфікований
  ok   no cookie, via /: status Кваліфікований
POST as marta (brightline) -> won:      HTTP 500 · status now: Кваліфікований
  ok   other workspace (marta): status Кваліфікований
POST as olena (owner) -> contacted:     HTTP 200 · status now: Контакт
  ok   owner (olena): status Контакт
result: protected (exit 0)
```

## `task-a/attack-after-review-vulnerable-77882b5.txt`

Той самий скрипт на вразливому коміті 77882b5 (тимчасовий worktree) — перевірка, що утвердження справді ловлять дірку:

```text
# vulnerable-77882b5 · 77882b5 · build REZtSKGqLwwpQv9LWA6xF · pid 82364 · action id 601d2ca494fd…
status before:                          Кваліфікований
POST without cookie -> lost:            HTTP 307 · status now: Кваліфікований
  ok   no cookie: status Кваліфікований
POST without cookie to / (no proxy) -> lost: HTTP 200 · status now: Кваліфікований
  ok   no cookie, via /: status Кваліфікований
POST as marta (brightline) -> won:      HTTP 200 · status now: Угода
  FAIL other workspace (marta): expected status Кваліфікований, got Угода
POST as olena (owner) -> contacted:     HTTP 200 · status now: Контакт
  ok   owner (olena): status Контакт
result: NOT protected (exit 1)
```
