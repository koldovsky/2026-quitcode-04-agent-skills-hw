#!/usr/bin/env node
// Статична перевірка коду проєкту на відповідність контракту integrating-n8n-webhooks.
// Node без залежностей: лише вбудовані модулі.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { execSync } from "node:child_process";

function parseArgs(argv) {
  const args = { root: ".", help: false, changedSince: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--changed-since") args.changedSince = argv[++i];
  }
  return args;
}

function printHelp() {
  console.log(`check-contract.mjs — статична перевірка контракту integrating-n8n-webhooks

Usage:
  node check-contract.mjs [options]

Options:
  --root <тека>            Яку теку перевіряти (за замовчуванням поточна).
  --changed-since <ref>    Перевіряти лише файли, змінені після git-ref
                            (разом з новими, ще не доданими в git), а в
                            наявних файлах — лише змінені рядки.
                            Без прапорця — перевіряється весь проєкт.
  -h, --help                Показати цю довідку.

Перевірки: C1..C5+, кожна з id і рядком PASS/FAIL. Код виходу ≠ 0, якщо є FAIL.
`);
}

const SCAN_DIRS = ["app", "lib", "components"];
const EXT_OK = [".ts", ".tsx", ".js", ".mjs"];

function walk(dir, root) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, root));
    } else {
      out.push(full);
    }
  }
  return out;
}

function collectFiles(root) {
  const files = [];
  for (const d of SCAN_DIRS) {
    files.push(...walk(join(root, d), root));
  }
  const envExample = join(root, ".env.example");
  if (existsSync(envExample)) files.push(envExample);
  return files;
}


function getChangedFiles(root, ref) {
  try {
    const diffOut = execSync(`git diff --name-only ${ref}`, { cwd: root, encoding: "utf8" });
    const untrackedOut = execSync(`git ls-files --others --exclude-standard`, {
      cwd: root,
      encoding: "utf8",
    });
    const changed = new Set(
      [...diffOut.split("\n"), ...untrackedOut.split("\n")].filter(Boolean).map((p) => join(root, p))
    );
    return changed;
  } catch {
    return null; // git недоступний чи ref не існує — перевіряємо все
  }
}

function readSafe(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function findLines(content, regex) {
  const lines = content.split("\n");
  const hits = [];
  lines.forEach((line, idx) => {
    if (regex.test(line)) hits.push({ line: idx + 1, text: line.trim() });
    regex.lastIndex = 0;
  });
  return hits;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const root = args.root;
  let files = collectFiles(root);

  if (args.changedSince) {
    const changed = getChangedFiles(root, args.changedSince);
    if (changed) {
      files = files.filter((f) => changed.has(f));
    }
  }

  const results = [];
  let failCount = 0;

  function report(id, description, failures) {
    if (failures.length === 0) {
      results.push(`${id} PASS — ${description}`);
    } else {
      failCount += failures.length;
      results.push(`${id} FAIL — ${description}`);
      for (const f of failures) {
        results.push(`     ${relative(root, f.file)}:${f.line}  ${f.text}`);
      }
    }
  }

  // C1 — тестовий URL n8n у коді чи .env.example
  {
    const failures = [];
    for (const f of files) {
      if (!EXT_OK.includes(extname(f)) && extname(f) !== "") {
        if (!f.endsWith(".env.example")) continue;
      }
      const content = readSafe(f);
      const hits = findLines(content, /webhook-test/i);
      for (const h of hits) failures.push({ file: f, line: h.line, text: h.text });
    }
    report("C1", "тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example", failures);
  }

  // C2 — N8N_* змінні з префіксом NEXT_PUBLIC_
  {
    const failures = [];
    for (const f of files) {
      const content = readSafe(f);
      const hits = findLines(content, /NEXT_PUBLIC_[A-Z0-9_]*N8N[A-Z0-9_]*/);
      for (const h of hits) failures.push({ file: f, line: h.line, text: h.text });
    }
    report("C2", "жодна змінна N8N_* не має префіксу NEXT_PUBLIC_", failures);
  }

  // C3 — виклики n8n лише з lib/n8n/client.ts
  {
    const failures = [];
    const clientPath = join(root, "lib", "n8n", "client.ts");
    for (const f of files) {
      if (f === clientPath) continue;
      if (!f.startsWith(join(root, "app")) && !f.startsWith(join(root, "components"))) continue;
      const content = readSafe(f);
      const hits = findLines(content, /N8N_WEBHOOK[A-Z_]*_URL/);
      for (const h of hits) failures.push({ file: f, line: h.line, text: h.text });
    }
    report("C3", "прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts", failures);
  }

  // C4 — fetch до n8n має таймаут (AbortSignal.timeout)
  {
    const failures = [];
    const clientPath = join(root, "lib", "n8n", "client.ts");
    if (existsSync(clientPath)) {
      const content = readSafe(clientPath);
      if (/fetch\(/.test(content) && !/AbortSignal\.timeout/.test(content)) {
        failures.push({ file: clientPath, line: 1, text: "fetch() без AbortSignal.timeout(...)" });
      }
    } else {
      failures.push({ file: clientPath, line: 0, text: "lib/n8n/client.ts не знайдено" });
    }
    report("C4", "виклик n8n використовує AbortSignal.timeout", failures);
  }

  // C5 — колбек-роут: сирий текст тіла до JSON.parse, timingSafeEqual замість ===
  {
    const failures = [];
    const routeCandidates = files.filter(
      (f) => f.includes(join("app", "api", "n8n")) && f.endsWith("route.ts")
    );
    if (routeCandidates.length === 0) {
      failures.push({ file: join(root, "app", "api", "n8n", "[event]", "route.ts"), line: 0, text: "колбек-роут не знайдено" });
    }
    for (const f of routeCandidates) {
      const content = readSafe(f);
      if (!/\.text\(\)/.test(content)) {
        failures.push({ file: f, line: 0, text: "тіло не читається як сирий текст (.text())" });
      }
      if (/signature\s*===|===\s*signature/.test(content)) {
        failures.push({ file: f, line: 0, text: "підпис звіряється через === замість timingSafeEqual" });
      }
      if (!/timingSafeEqual/.test(content)) {
        failures.push({ file: f, line: 0, text: "timingSafeEqual не використовується для звірки підпису" });
      }
    }
    report("C5", "колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual", failures);
  }

  console.log(results.join("\n"));
  console.log(`\n${failCount === 0 ? "0 FAIL" : `${failCount} FAIL`}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();