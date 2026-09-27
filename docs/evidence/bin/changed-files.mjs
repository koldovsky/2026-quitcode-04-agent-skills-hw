#!/usr/bin/env node
// Inventory of EVERY file this branch changes against main, so the report cannot drift from the diff.
//   node docs/evidence/bin/changed-files.mjs            print the markdown table
//   node docs/evidence/bin/changed-files.mjs --write    replace the table between the markers in docs/verification.md
//   node docs/evidence/bin/changed-files.mjs --check    exit 1 if that table differs from the current diff
// Source of truth: `git diff --name-status --no-renames main...HEAD` (a rename = deleted + added row) and `git log main..HEAD -- <file>`. A changed file
// without a description below makes the script fail: new changes must be described before they are listed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DOC = "docs/verification.md";
const START = "<!-- changed-files:start -->", END = "<!-- changed-files:end -->";
const git = (...a) => execFileSync("git", ["-c", "core.quotePath=false", ...a], { encoding: "utf8" }).trim();

// [pattern, task, what] — first match wins. Code files are described one by one.
const RULES = [
  [/^\.claude\/skills\/vercel-react-best-practices\/rules\//, "A", "правило скіла Vercel, вендорено без змін (72 файли разом)"],
  [/^\.claude\/skills\/vercel-react-best-practices\//, "A", "скіл Vercel, вендорено без змін (`skills@1.7.0 --copy`, тег `agent-skills-063bee94…`)"],
  [/^skills-lock\.json$/, "A", "закріплення версії скіла Vercel: `ref` + `computedHash`"],
  [/^docs\/skill-review\.md$/, "A", "рев'ю скіла Vercel до встановлення (історія правок — у шапці файлу)"],
  [/^app\/dashboard\/page\.tsx$/, "A", "`async-parallel`, `server-serialization` (`LeadRow`), `server-cache-react` (`getWorkspace(slug)`), `async-suspense-boundaries`; після код-рев'ю — відмова `statsPromise` позначена обробленою"],
  [/^app\/dashboard\/layout\.tsx$/, "A", "`server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }`"],
  [/^app\/dashboard\/leads\/\[id\]\/page\.tsx$/, "A", "`server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }`"],
  [/^components\/dashboard-header\.tsx$/, "A", "`server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }`"],
  [/^lib\/data\.ts$/, "A", "`server-cache-react`: `getCurrentUser` і `getWorkspace(slug: string)` у `cache()`"],
  [/^components\/leads-table\.tsx$/, "A", "`server-serialization`: тип `LeadRow` (5 полів) замість `Lead`"],
  [/^components\/leads-toolbar\.tsx$/, "A", "`bundle-conditional` (`import(\"exceljs\")` у кліку), `bundle-dynamic-imports` (`SourcesChart` через `next/dynamic`)"],
  [/^app\/actions\.ts$/, "A, D", "A: `authorizeLead` у `updateLeadStatus`/`deleteLead` (`server-auth-actions`); D: `submitLead` → `triggerWorkflow(\"lead-created\")` в `after()`, при невдачі — аудит `lead.n8n_failed` (рев'ю CodeRabbit)"],
  [/^\.claude\/skills\/building-client-form\//, "B", "скіл лише з інструкцій; v0.1.1 — приховане поле замість `bind`"],
  [/^\.claude\/skills\/integrating-n8n-webhooks\/SKILL\.md$/, "C", "скіл n8n: опис, правила зупинки, чеклист; пізніші коміти змінюють лише рядок `version` (0.1.1, 0.1.2, 0.1.3, 0.1.4)"],
  [/^\.claude\/skills\/integrating-n8n-webhooks\/references\/code-templates\.md$/, "C", "шаблони коду; v0.1.2 — `safeDocumentUrl` (рев'ю CodeRabbit); v0.1.3 — статус одним записом, строгий бюджет, `event` ↔ `status` (аудит); v0.1.4 — `ready` кінцевий, ключі колбеків добу (код-рев'ю)"],
  [/^\.claude\/skills\/integrating-n8n-webhooks\/references\/contract\.md$/, "C", "повний контракт; v0.1.3 — крок 7: `event` ↔ `data.status` (аудит)"],
  [/^\.claude\/skills\/integrating-n8n-webhooks\/scripts\/(check-contract|selftest-check-contract)\.mjs$/, "C", "перевірки C1–C15 і їхній selftest; v0.1.1 — C10/C14 після Task D; v0.1.2 — C12 після рев'ю CodeRabbit"],
  [/^\.claude\/skills\/integrating-n8n-webhooks\//, "C", "файл скіла n8n, без змін після першого коміту скіла"],
  [/^\.env\.example$/, "D", "4 ключі контракту з прогону B1; прибрано `N8N_WEBHOOK_URL` з `/webhook-test/`"],
  [/^app\/quotes\/new\/page\.tsx$/, "D", "прогін B1: сторінка форми кошторису"],
  [/^app\/quotes\/\[id\]\/page\.tsx$/, "D", "прогін B1: сторінка статусу запиту"],
  [/^app\/quotes\/actions\.ts$/, "D", "прогін B1: Server Action `requestQuote`, n8n в `after()`; після аудиту — `sent`/`failed` лише з `queued` одним записом; після код-рев'ю — назва помилки в журналі"],
  [/^app\/api\/n8n\/\[event\]\/route\.ts$/, "D", "прогін B1: колбек-роут з HMAC, вікном 300 с, ідемпотентністю; після аудиту — суфікс `event` має збігатися з `data.status`; після код-рев'ю — `ready` кінцевий"],
  [/^components\/quote-form\.tsx$/, "D", "прогін B1: форма з `useActionState`; після рев'ю CodeRabbit — `aria-invalid`, `aria-describedby`, `role=\"alert\"`; після аудиту — `inputMode=\"decimal\"`"],
  [/^components\/auto-refresh\.tsx$/, "D", "прогін B1: `router.refresh()` кожні 5 с; після рев'ю CodeRabbit — не більше 60 разів"],
  [/^lib\/n8n\/client\.ts$/, "D", "прогін B1: єдиний модуль, що говорить з n8n; після код-рев'ю — `N8nConfigError`"],
  [/^lib\/quote-form\.ts$/, "D", "прогін B1: розбір і валідація форми кошторису; після аудиту — бюджет з десятковими, без видалення ком; після код-рев'ю — задовгий бюджет — помилка"],
  [/^lib\/db\.ts$/, "D", "прогін B1: сховище запитів і застовплених ключів колбеків; після аудиту — `updateQuote(…, ifStatus)`; після код-рев'ю — `ifStatus` списком, ключі колбеків живуть добу"],
  [/^lib\/types\.ts$/, "D", "прогін B1: типи `Quote`, `QuoteStatus`"],
  [/^docs\/n8n-integrations\.md$/, "D", "реєстр інтеграцій: `quote-request` (прогін B1; формат `budget`, звірка `event` ↔ `status`, `ready` кінцевий), `lead-created` (доведення, `lead.n8n_failed`)"],
  [/^docs\/ab-validation\.md$/, "D", "звіт A/B: перша пара (A1/A2, B1/B2), друга пара A3/B3, перенесення прогону B1, дефекти з аудиту"],
  [/^docs\/ab\//, "D", "повний діф прогону агента від тегу `base` копії"],
  [/^docs\/trigger-evals\.md$/, "E2", "тест спрацювання n8n-скіла, 12 запитів"],
  [/^docs\/verification\.md$/, "A–C", "звіт перевірки Task A–C, ця таблиця, розділи «Після рев'ю CodeRabbit», «Переписана історія», «Після аудиту», «Після код-рев'ю»"],
  [/^docs\/evidence\/bin\//, "A–E", "обв'язка сесій і вимірів, пакування доказів"],
  [/^docs\/evidence\/raw-evidence\.tar\.gz$/, "A–E", "оригінали 203 файлів доказів: 167 першого пакування, 36 пари A3/B3"],
  [/^docs\/evidence\/task-a\//, "A", "докази Task A"],
  [/^docs\/evidence\/task-b\//, "B", "докази Task B"],
  [/^docs\/evidence\/task-c\//, "C", "докази Task C"],
  [/^docs\/evidence\/task-d\//, "D", "докази Task D"],
  [/^docs\/evidence\/task-e\//, "E2", "докази Task E2"],
];

const STATUS = { A: "додано", M: "змінено", D: "видалено" };
const rows = git("diff", "--name-status", "--no-renames", "main...HEAD").split("\n").filter(Boolean).map((l) => {
  const [st, file] = l.split("\t");
  const rule = RULES.find(([re]) => re.test(file));
  if (!rule) { console.error(`NO DESCRIPTION for changed file: ${file} — add it to RULES first`); process.exit(2); }
  const commits = git("log", "--format=%h", "main..HEAD", "--", file).split("\n").filter(Boolean).reverse();
  return { st: STATUS[st[0]] ?? st, file, task: rule[1], what: rule[2], commits };
});

// the 72 vendored rule files collapse into one row; everything else is listed file by file
const RULES_DIR = ".claude/skills/vercel-react-best-practices/rules/";
const vendored = rows.filter((r) => r.file.startsWith(RULES_DIR));
const listed = rows.filter((r) => !r.file.startsWith(RULES_DIR));
// this table lives in DOC, so DOC's own commit list would change with every rewrite of the table
const commitsOf = (r) => (r.file === DOC ? `\`git log main..HEAD -- ${DOC}\`` : r.commits.map((c) => `\`${c}\``).join(" "));
const fmt = (r) => `| \`${r.file}\` | ${r.st} | ${r.task} | ${commitsOf(r)} | ${r.what} |`;
const tableRows = listed.map(fmt);
if (vendored.length) {
  const idx = tableRows.findIndex((l) => l.includes("vercel-react-best-practices/SKILL.md"));
  tableRows.splice(idx + 1, 0, `| \`${RULES_DIR}*.md\` (${vendored.length} файли) | ${vendored[0].st} | A | ${[...new Set(vendored.flatMap((r) => r.commits))].map((c) => `\`${c}\``).join(" ")} | ${vendored[0].what} |`);
}
const code = rows.filter((r) => /^(app|components|lib)\//.test(r.file) || r.file === ".env.example").length;
const table = [
  START,
  `Згенеровано \`node docs/evidence/bin/changed-files.mjs --write\` з \`git diff --name-status --no-renames main...HEAD\`; ` +
    `\`--check\` падає, якщо таблиця розійшлась із діфом. **Усього ${rows.length} файлів**: код застосунку й \`.env.example\` — ${code}, ` +
    `вендорений скіл Vercel — ${rows.filter((r) => r.file.startsWith(".claude/skills/vercel-react-best-practices/")).length}, ` +
    `власні скіли — ${rows.filter((r) => /^\.claude\/skills\/(building-client-form|integrating-n8n-webhooks)\//.test(r.file)).length}, ` +
    `документи й докази — ${rows.filter((r) => r.file.startsWith("docs/")).length}, інше — ${rows.filter((r) => r.file === "skills-lock.json").length} (\`skills-lock.json\`). ` +
    `Поза цим списком гілка не змінює нічого: \`tools/\`, \`materials/\`, \`.github/\`, \`.coderabbit.yaml\`, \`package.json\`, \`package-lock.json\` — без змін.`,
  "",
  "| Файл | Статус | Task | Коміти | Що змінено |",
  "|---|---|---|---|---|",
  ...tableRows,
  END,
].join("\n");

const mode = process.argv[2];
if (!mode) { console.log(table); process.exit(0); }
const doc = readFileSync(DOC, "utf8");
const a = doc.indexOf(START), b = doc.indexOf(END);
if (a < 0 || b < 0) { console.error(`markers not found in ${DOC}`); process.exit(2); }
const current = doc.slice(a, b + END.length);
if (mode === "--check") {
  if (current === table) { console.log(`${DOC}: table matches the diff (${rows.length} files)`); process.exit(0); }
  const have = new Set([...current.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]));
  const want = new Set([...table.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]));
  for (const f of want) if (!have.has(f)) console.log(`missing in ${DOC}: ${f}`);
  for (const f of have) if (!want.has(f)) console.log(`listed but not changed: ${f}`);
  console.log(`${DOC}: table differs from the diff — run with --write`); process.exit(1);
}
if (mode === "--write") { writeFileSync(DOC, doc.slice(0, a) + table + doc.slice(b + END.length)); console.log(`wrote ${rows.length} files into ${DOC}`); }
