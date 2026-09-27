#!/usr/bin/env node
// Packs docs/evidence so the PR stays under CodeRabbit's 100-file limit, without losing anything.
//   node docs/evidence/bin/pack-evidence.mjs            (repo root; then review `git status`)
// Every "unit" directory keeps: summary.md (each small file of the unit as its own section, headed by
// its original path), transcript.md (readable, from session-report.mjs --md) and the scripts listed in
// KEEP. Every original file of a unit goes into docs/evidence/raw-evidence.tar.gz first, the raw
// transcript.jsonl files only there. Links and mentions of moved files in docs/*.md are rewritten to
// the unit's summary.md, whose section heading is the original path.
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { execFileSync } from "node:child_process";

const EV = "docs/evidence";
const KEEP = new Set([
  "task-a/measure-dashboard.sh", "task-a/attack-server-actions.sh", "task-a/vercel-review/transcript.md",
  "task-b/verify-note-form.sh", "task-b/nojs-isolation.sh", "task-b/run-1/transcript.md", "task-b/run-2/transcript.md",
  "task-d/scenario.sh", "task-d/lead-check.sh",
]);
// unit dir -> files of that dir tree go into <unit>/summary.md (subdirs that are units themselves excluded)
const UNITS = ["task-a", "task-b", "task-d", "task-d/probe", "task-d/branch",
  "task-d/run-a1", "task-d/run-a2", "task-d/run-b1", "task-d/run-b2", "task-e"];
const TRANSCRIPT_UNITS = ["task-d/probe", "task-d/run-a1", "task-d/run-a2", "task-d/run-b1", "task-d/run-b2"];

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const unitOf = (rel) => UNITS.filter((u) => rel === u || rel.startsWith(u + "/")).sort((a, b) => b.length - a.length)[0];
const DIFF_TWINS = { "task-d/run-a1/agent.diff": "docs/ab/a-without-skill.diff", "task-d/run-a2/agent.diff": "docs/ab/a-without-skill-run2.diff",
  "task-d/run-b1/agent.diff": "docs/ab/b-with-skill.diff", "task-d/run-b2/agent.diff": "docs/ab/b-with-skill-run2.diff" };

const all = walk(EV).map((p) => relative(EV, p)).filter((r) => !r.startsWith("bin/") && !r.startsWith("task-c/") && r !== "raw-evidence.tar.gz");
const packed = all.filter((r) => unitOf(r) && !KEEP.has(r) && !/(^|\/)(summary|transcript)\.md$/.test(r));
if (!packed.length) { console.log("nothing to pack"); process.exit(0); }

// 1. readable transcripts before the raw JSONL leaves the tree
for (const u of TRANSCRIPT_UNITS) if (existsSync(join(EV, u, "transcript.jsonl")))
  execFileSync(process.execPath, [join(EV, "bin/session-report.mjs"), join(EV, u), "--md"], { stdio: "ignore" });

// 2. everything that is about to be removed goes into the tarball (appended if it exists)
const tar = join(EV, "raw-evidence.tar.gz");
if (existsSync(tar)) { console.error(`${tar} exists: packing runs once; unpack it first to repack`); process.exit(1); }
const listFile = join(process.env.TMPDIR ?? "/tmp", "pack-evidence-list.txt");
writeFileSync(listFile, packed.join("\n") + "\n");
execFileSync("tar", ["-czf", tar, "-C", EV, "-T", listFile]);

// 3. summary.md per unit
const byUnit = Object.groupBy(packed, unitOf);
for (const [u, files] of Object.entries(byUnit)) {
  const sum = join(EV, u, "summary.md");
  const head = existsSync(sum) ? readFileSync(sum, "utf8") : `# Evidence: ${u}\n\nPacked by \`docs/evidence/bin/pack-evidence.mjs\`. Each section is one original file; ` +
    `the originals (and raw \`transcript.jsonl\`) are in \`docs/evidence/raw-evidence.tar.gz\`.\n`;
  let body = head;
  for (const r of files.sort()) {
    if (r.endsWith(".jsonl")) { body += `\n## \`${r}\`\n\nRaw stream-json transcript, only in \`raw-evidence.tar.gz\`. Readable form: \`transcript.md\` of this unit.\n`; continue; }
    if (DIFF_TWINS[r]) { body += `\n## \`${r}\`\n\nByte-identical to [\`${DIFF_TWINS[r]}\`](../../../${DIFF_TWINS[r].slice(5)}).\n`; continue; }
    const text = readFileSync(join(EV, r), "utf8");
    const lang = r.endsWith(".diff") ? "diff" : r.endsWith(".sh") ? "bash" : r.endsWith(".md") ? "markdown" : "text";
    const fence = text.includes("```") ? "````" : "```";
    body += `\n## \`${r}\`\n\n${text.length ? `${fence}${lang}\n${text.replace(/\n$/, "")}\n${fence}` : "_(empty file)_"}\n`;
  }
  writeFileSync(sum, body);
}

// 4. remove the packed originals and now-empty dirs
for (const r of packed) rmSync(join(EV, r));
const prune = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) prune(p); }
  if (!readdirSync(d).length) rmSync(d, { recursive: true }); };
prune(EV);

// 5. rewrite references in docs/*.md
const docs = walk("docs").filter((p) => p.endsWith(".md") && !p.startsWith(EV) && !p.startsWith("docs/templates") && basename(p) !== "walkthrough.md");
const map = Object.fromEntries(packed.map((r) => [r, `${unitOf(r)}/summary.md`]));
const keys = Object.keys(map).sort((a, b) => b.length - a.length);
for (const f of docs) {
  let s = readFileSync(f, "utf8"); const before = s;
  for (const k of keys) s = s.split(`evidence/${k}`).join(`evidence/${map[k]}`);
  // directory links like (evidence/task-d/probe/) stay valid: the dir still has summary.md
  if (s !== before) { writeFileSync(f, s); console.log(`rewrote links in ${f}`); }
}
console.log(`packed ${packed.length} files into ${Object.keys(byUnit).length} summary.md + ${tar}`);
