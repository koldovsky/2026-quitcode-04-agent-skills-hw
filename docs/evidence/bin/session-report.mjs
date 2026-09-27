#!/usr/bin/env node
// Transcript (stream-json JSONL) → facts that a report would otherwise state "from memory".
//   node docs/evidence/bin/session-report.mjs <run-dir> [--md]
// Prints: model, skills offered to the session, Skill tool calls, reads under .claude/skills/,
// every file the agent read (Read + cat/sed/head/grep via Bash), paths outside the work dir,
// tool counts, turns, cost, final answer. With --md also writes <run-dir>/transcript.md.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("usage: session-report.mjs <run-dir> [--md]"); process.exit(2); }
const rows = readFileSync(join(dir, "transcript.jsonl"), "utf8").split("\n").filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const init = rows.find((r) => r.type === "system" && r.subtype === "init") ?? {};
const result = rows.find((r) => r.type === "result") ?? {};
const cwd = init.cwd ?? "";
const uses = [];
const results = new Map();
for (const r of rows) for (const b of r?.message?.content ?? []) {
  if (b?.type === "tool_use") uses.push({ id: b.id, name: b.name, input: b.input ?? {} });
  if (b?.type === "tool_result") results.set(b.tool_use_id, b);
}

const pathOf = (u) => u.input.file_path ?? u.input.path ?? u.input.notebook_path ?? "";
const SHELL_READ = /\b(cat|sed|head|tail|less|grep|rg|awk|nl|find|ls)\b/;
const PATHISH = /(?:\.{0,2}\/)?[\w.@\[\]-]+(?:\/[\w.@\[\]-]+)+|\b[\w-]+\.(?:md|ts|tsx|mjs|js|json|css|txt)\b/g;
const read = [];
for (const u of uses) {
  if (u.name === "Read") read.push(pathOf(u));
  if ((u.name === "Grep" || u.name === "Glob") && u.input.path) read.push(u.input.path);
  if (u.name === "Bash" && SHELL_READ.test(u.input.command ?? "")) {
    // The work dir may contain spaces ("Work Folder"): replace it before splitting into path tokens.
    const cmd = cwd ? u.input.command.split(`"${cwd}"`).join(".").split(cwd).join(".") : u.input.command;
    read.push(...(cmd.replace(/^cd \. && /, "").match(PATHISH) ?? []));
  }
}
const rel = (p) => (cwd && p.startsWith(cwd + "/") ? p.slice(cwd.length + 1) : p);
const outside = [...new Set(read.filter((p) => {
  const abs = isAbsolute(p) ? p : resolve(cwd, p);
  return cwd && !(abs === cwd || abs.startsWith(cwd + "/")) && !abs.includes("/node_modules/");
}))];
const bashOutside = uses.filter((u) => u.name === "Bash" &&
    /(^|[\s"'])(\.\.\/|~\/|\/Users\/)/.test(cwd ? u.input.command.split(cwd).join(".") : u.input.command ?? ""))
  .map((u) => u.input.command.slice(0, 160));

const skillCalls = uses.filter((u) => u.name === "Skill").map((u) => u.input.skill ?? u.input.command ?? JSON.stringify(u.input));
const skillReads = [...new Set(read.map(rel).filter((p) => p.includes(".claude/skills/")))];
const count = {};
for (const u of uses) count[u.name] = (count[u.name] ?? 0) + 1;
const denied = uses.filter((u) => {
  const t = results.get(u.id); const s = JSON.stringify(t?.content ?? "");
  return t?.is_error && /No such tool|not allowed|denied|permission/i.test(s);
}).map((u) => u.name);

const lines = [
  `model: ${init.model ?? "?"}`,
  `cwd: ${cwd}`,
  `skills offered (init.skills): ${(init.skills ?? []).join(", ") || "—"}`,
  `tools offered: ${(init.tools ?? []).join(", ")}`,
  `Skill tool calls: ${skillCalls.length ? skillCalls.join(", ") : "none"}`,
  `reads under .claude/skills/: ${skillReads.length ? skillReads.join(", ") : "none"}`,
  `files read (${[...new Set(read.map(rel))].length}): ${[...new Set(read.map(rel))].join(", ") || "—"}`,
  `paths outside work dir (excl. node_modules): ${outside.length ? outside.join(", ") : "none"}`,
  `bash commands touching ../ ~/ /Users/: ${bashOutside.length ? bashOutside.join(" ‖ ") : "none"}`,
  `tool calls: ${Object.entries(count).map(([k, v]) => `${k}×${v}`).join(", ") || "—"}`,
  `denied tool calls: ${denied.length ? denied.join(", ") : "none"}`,
  `turns: ${result.num_turns ?? "?"} · duration: ${Math.round((result.duration_ms ?? 0) / 1000)}s · cost: $${(result.total_cost_usd ?? 0).toFixed(2)}`,
];
console.log(lines.join("\n"));

if (process.argv.includes("--md")) {
  const cut = (s, n) => (s.length > n ? s.slice(0, n) + `\n… [cut, ${s.length - n} more chars]` : s);
  const md = ["# Transcript", "", "```", ...lines, "```", ""];
  let step = 0;
  for (const r of rows) for (const b of r?.message?.content ?? []) {
    if (b.type === "text" && b.text?.trim() && r.type === "assistant") md.push("### agent", "", cut(b.text.trim(), 4000), "");
    if (b.type === "tool_use") {
      step++;
      const arg = b.input?.command ?? b.input?.file_path ?? b.input?.pattern ?? b.input?.skill ?? JSON.stringify(b.input ?? {});
      md.push(`### ${step}. \`${b.name}\``, "", "```", cut(String(arg), 600), "```", "");
    }
  }
  md.push("---", "", "## Final answer", "", (result.result ?? "").trim() || "_(empty)_", "");
  writeFileSync(join(dir, "transcript.md"), md.join("\n"));
}
