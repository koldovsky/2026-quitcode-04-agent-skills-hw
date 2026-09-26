#!/usr/bin/env node
// Static checker for the integrating-n8n-webhooks contract (see ../SKILL.md and
// ../references/). Node built-ins only, no dependencies.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

const HELP = `check-contract.mjs — static checks for the Next.js <-> n8n webhook contract

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>] [--help]

Options:
  --root <dir>          Directory to check (default: current directory).
  --changed-since <ref> Only scan files changed since <ref> (tracked diffs +
                         untracked new files), file-level granularity (not
                         per-line). Requires --root to be inside a git repo.
                         Optional/bonus: not required for a passing review.
  --help                Show this help and exit 0.

Exit code is non-zero if any check reports a FAIL.
`;

function parseArgs(argv) {
  const args = { root: ".", changedSince: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--changed-since") args.changedSince = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const ROOT = args.root;
if (!existsSync(ROOT)) {
  console.error(`Root not found: ${ROOT}`);
  process.exit(2);
}

const SCAN_DIRS = ["app", "components", "lib"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".mjs"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", ".next", ".claude"]);

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (SOURCE_EXT.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles(root) {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const full = join(root, dir);
    if (existsSync(full)) walk(full, files);
  }
  // .env.local is gitignored, per-developer, and explicitly allowed to point at a
  // test webhook URL while poking around in the n8n editor — only .env.example
  // (what actually ships) is part of the contract.
  const envExample = join(root, ".env.example");
  if (existsSync(envExample) && statSync(envExample).isFile()) files.push(envExample);
  return files;
}

function getChangedFiles(root, ref) {
  const opts = { cwd: root, encoding: "utf8" };
  let tracked = [];
  let untracked = [];
  try {
    tracked = execFileSync("git", ["diff", "--name-only", ref], opts)
      .split("\n")
      .filter(Boolean);
    untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], opts)
      .split("\n")
      .filter(Boolean);
  } catch (error) {
    console.error(
      `--changed-since: git command failed (${error.message.split("\n")[0]}); falling back to a full scan.`,
    );
    return null;
  }
  return new Set([...tracked, ...untracked].map((p) => p.split("/").join(sep)));
}

function readLines(file) {
  try {
    return readFileSync(file, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}

function relPath(root, file) {
  return relative(root, file).split(sep).join("/");
}

function isUnderDir(root, file, dir) {
  return relPath(root, file).startsWith(`${dir}/`);
}

// ---- individual checks -----------------------------------------------------
// Each check returns { violations: [{file, line, message}], applicable: bool }.
// applicable=false means "nothing in this codebase to check yet" (e.g. the
// callback route doesn't exist) — reported as PASS but flagged as untested by
// real violations; verify such checks separately against a deliberately bad
// snippet (see SKILL.md Verify section).

function checkTestWebhookUrl(root, files) {
  const violations = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      if (line.includes("/webhook-test/")) {
        violations.push({ file, line: i + 1, message: "test webhook URL (/webhook-test/) outside .env.local" });
      }
    });
  }
  return { violations, applicable: true };
}

function checkPublicPrefixedSecret(root, files) {
  const re = /NEXT_PUBLIC_[A-Z0-9_]*N8N[A-Z0-9_]*/;
  const violations = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      if (re.test(line)) {
        violations.push({ file, line: i + 1, message: "N8N_* variable with NEXT_PUBLIC_ prefix (ships to the client bundle)" });
      }
    });
  }
  return { violations, applicable: true };
}

function checkSingleServerModule(root, files) {
  const violations = [];
  for (const file of files) {
    if (isUnderDir(root, file, "lib/n8n")) continue;
    const lines = readLines(file);
    const hasN8nEnvRef = lines.some((l) => /\bN8N_[A-Z0-9_]*URL\b|\bN8N_[A-Z0-9_]*TOKEN\b/.test(l));
    if (!hasN8nEnvRef) continue;
    const fetchIdx = lines.findIndex((l) => /\bfetch\s*\(/.test(l));
    if (fetchIdx !== -1) {
      violations.push({
        file,
        line: fetchIdx + 1,
        message: "call to n8n outside lib/n8n/ (should live in one server-only module)",
      });
    }
  }
  return { violations, applicable: true };
}

function checkServerOnlyImport(root, files) {
  const targetFiles = files.filter((f) => isUnderDir(root, f, "lib/n8n") && f.endsWith(".ts"));
  if (targetFiles.length === 0) return { violations: [], applicable: false };
  const violations = [];
  for (const file of targetFiles) {
    const lines = readLines(file).filter((l) => l.trim() !== "");
    const first = (lines[0] ?? "").trim();
    if (!/^import\s+["']server-only["'];?$/.test(first)) {
      violations.push({ file, line: 1, message: "lib/n8n module missing `import \"server-only\";` as its first line" });
    }
  }
  return { violations, applicable: true };
}

function checkFetchTimeout(root, files) {
  const violations = [];
  for (const file of files) {
    const lines = readLines(file);
    const hasN8nEnvRef = lines.some((l) => /\bN8N_[A-Z0-9_]*URL\b/.test(l));
    const fetchIdx = lines.findIndex((l) => /\bfetch\s*\(/.test(l));
    if (!hasN8nEnvRef || fetchIdx === -1) continue;
    const hasTimeout = lines.some((l) => l.includes("AbortSignal.timeout("));
    if (!hasTimeout) {
      violations.push({ file, line: fetchIdx + 1, message: "fetch() to n8n without AbortSignal.timeout(...)" });
    }
  }
  return { violations, applicable: true };
}

function findCallbackRouteFiles(root, files) {
  return files.filter((f) => relPath(root, f).includes("api/n8n") && f.endsWith("route.ts"));
}

function checkRawBodyBeforeParse(root, files) {
  const targets = findCallbackRouteFiles(root, files);
  if (targets.length === 0) return { violations: [], applicable: false };
  const violations = [];
  for (const file of targets) {
    const lines = readLines(file);
    const parseIdx = lines.findIndex((l) => /\.json\s*\(\s*\)|JSON\.parse\s*\(/.test(l));
    const sigIdx = lines.findIndex((l) => l.includes("timingSafeEqual"));
    if (parseIdx !== -1 && (sigIdx === -1 || parseIdx < sigIdx)) {
      violations.push({
        file,
        line: parseIdx + 1,
        message: "body parsed as JSON before the signature is verified (re-serialization breaks the HMAC)",
      });
    }
  }
  return { violations, applicable: true };
}

function checkSignatureTimingSafe(root, files) {
  const targets = findCallbackRouteFiles(root, files);
  if (targets.length === 0) return { violations: [], applicable: false };
  const violations = [];
  for (const file of targets) {
    const lines = readLines(file);
    const mentionsSignature = lines.some((l) => /signature/i.test(l));
    const usesTimingSafe = lines.some((l) => l.includes("timingSafeEqual"));
    if (mentionsSignature && !usesTimingSafe) {
      const line = lines.findIndex((l) => /signature/i.test(l)) + 1;
      violations.push({ file, line, message: "signature compared without crypto.timingSafeEqual" });
    }
  }
  return { violations, applicable: true };
}

function checkNoSecretsInLogs(root, files) {
  const secretIds = ["N8N_CALLBACK_SECRET", "N8N_WEBHOOK_TOKEN", "x-n8n-signature", "x-n8n-token"];
  const violations = [];
  for (const file of files) {
    readLines(file).forEach((line, i) => {
      if (!/console\.(log|error|warn|info)/.test(line)) return;
      if (secretIds.some((id) => line.toLowerCase().includes(id.toLowerCase()))) {
        violations.push({ file, line: i + 1, message: "console.* call appears to log a secret/signature identifier" });
      }
    });
  }
  return { violations, applicable: true };
}

const CHECKS = [
  ["C1", "no test webhook URL (/webhook-test/) outside .env.local", checkTestWebhookUrl],
  ["C2", "no NEXT_PUBLIC_-prefixed N8N_* variable", checkPublicPrefixedSecret],
  ["C3", "n8n calls confined to lib/n8n/", checkSingleServerModule],
  ["C4", "lib/n8n module starts with import \"server-only\"", checkServerOnlyImport],
  ["C5", "fetch() to n8n has AbortSignal.timeout(...)", checkFetchTimeout],
  ["C6", "callback route reads raw body before JSON-parsing it", checkRawBodyBeforeParse],
  ["C7", "callback signature compared via crypto.timingSafeEqual", checkSignatureTimingSafe],
  ["C8", "no secret/signature values in console logs", checkNoSecretsInLogs],
];

function main() {
  const files = collectFiles(ROOT);
  let scanFiles = files;

  if (args.changedSince) {
    const changed = getChangedFiles(ROOT, args.changedSince);
    if (changed) {
      scanFiles = files.filter((f) => changed.has(relative(ROOT, f)));
      console.log(`--changed-since ${args.changedSince}: scanning ${scanFiles.length}/${files.length} file(s) (file-level, not per-line).\n`);
    }
  }

  let failCount = 0;
  for (const [id, description, check] of CHECKS) {
    const { violations, applicable } = check(ROOT, scanFiles);
    if (!applicable) {
      console.log(`[${id}] ${description}: PASS (nothing to check yet — no matching file in this root)`);
      continue;
    }
    if (violations.length === 0) {
      console.log(`[${id}] ${description}: PASS`);
    } else {
      console.log(`[${id}] ${description}: FAIL`);
      for (const v of violations) {
        console.log(`  ${relPath(ROOT, v.file)}:${v.line} — ${v.message}`);
      }
      failCount += violations.length;
    }
  }

  console.log(`\n${failCount === 0 ? "0 FAIL" : `${failCount} FAIL(s)`}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
