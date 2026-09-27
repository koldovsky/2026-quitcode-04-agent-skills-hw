# Evidence: task-b

Packed by `docs/evidence/bin/pack-evidence.mjs`. Each section is one original file; the originals (and raw `transcript.jsonl`) are in `docs/evidence/raw-evidence.tar.gz`.

## `task-b/nojs-isolation.txt`

```text
# Why the no-JS submit of run-1's note form hangs — isolation in a worktree outside the repo
# (/private/tmp/claude-501/measure-wt at d4a9ca7 + run-1 agent diff), script: nojs-isolation.sh.
# Each variant: npm run build, next start (owned port), GET lead page, replay the note <form> with
# its hidden $ACTION_* inputs as multipart (what a browser without JS sends), empty note, 10 s timeout.
agent-code        (useActionState(addLeadNote.bind(null, leadId)))         -> HTTP 000 after 10.0 s (no headers)
V1-return-first   (same, action returns {status:"invalid"} as 1st line)   -> HTTP 000 after 10.0 s
V2-unbound        (useActionState(addLeadNote) + <input type=hidden name=leadId>) -> HTTP 200 in 0.52 s
# Also seen: real browser, native HTMLFormElement.submit() of the server-rendered form (bypassing React)
# on run-1 code -> navigation never finished (page stuck loading). Untouched public form on / with the
# same replay -> HTTP 200 in 0.04 s with field errors, so the replay itself is sound.
# Conclusion: in Next.js 16.3.5 / React 19.2.8, useActionState with a .bind()-bound Server Action does
# not survive a no-JS submit on this dynamic route: the action runs (db:appendLeadNote in the server
# log), the response never starts. The skill told the agent to use .bind -> the skill is fixed.
```

## `task-b/run-1/agent.diff`

```diff
diff --git a/app/actions.ts b/app/actions.ts
index dac5aac..fda9389 100644
--- a/app/actions.ts
+++ b/app/actions.ts
@@ -2,10 +2,12 @@
 
 import { headers } from "next/headers";
 import { revalidatePath } from "next/cache";
+import { after } from "next/server";
 import { db } from "@/lib/db";
 import { logAudit } from "@/lib/audit";
 import { getCurrentUser, getWorkspace } from "@/lib/data";
 import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
+import { parseLeadNoteForm, type LeadNoteField } from "@/lib/lead-note-form";
 import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
 
 const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";
@@ -84,6 +86,39 @@ export async function updateLeadStatus(id: string, status: LeadStatus) {
   revalidatePath(`/dashboard/leads/${id}`);
 }
 
+export type AddLeadNoteState =
+  | { status: "idle" }
+  | {
+      status: "invalid";
+      errors: Partial<Record<LeadNoteField, string>>;
+      values: Partial<Record<LeadNoteField, string>>;
+    }
+  | { status: "ok" }
+  | { status: "error" };
+
+// Bound as addLeadNote.bind(null, leadId): the id is still client-controlled, so check it here.
+export async function addLeadNote(
+  id: string,
+  _prevState: AddLeadNoteState,
+  formData: FormData,
+): Promise<AddLeadNoteState> {
+  await getCurrentUser(); // no session -> redirect("/login"); outside the catch below
+  const leadId = await authorizeLead(id).catch(() => null);
+  if (!leadId) return { status: "error" };
+
+  const parsed = parseLeadNoteForm(formData);
+  if (!parsed.ok) {
+    return { status: "invalid", errors: parsed.errors, values: parsed.values };
+  }
+
+  const saved = await db.appendLeadNote(leadId, parsed.data.note);
+  if (!saved) return { status: "error" };
+
+  after(() => logAudit("lead.note_added", leadId));
+  revalidatePath(`/dashboard/leads/${leadId}`);
+  return { status: "ok" };
+}
+
 export async function deleteLead(id: string) {
   await authorizeLead(id);
   await db.deleteLead(id);
diff --git a/app/dashboard/leads/[id]/page.tsx b/app/dashboard/leads/[id]/page.tsx
index 13b72ac..5e9cd79 100644
--- a/app/dashboard/leads/[id]/page.tsx
+++ b/app/dashboard/leads/[id]/page.tsx
@@ -1,6 +1,7 @@
 import Link from "next/link";
 import { notFound } from "next/navigation";
 import { LeadActions } from "@/components/lead-actions";
+import { LeadNoteForm } from "@/components/lead-note-form";
 import { StatusBadge } from "@/components/status-badge";
 import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
 
@@ -60,12 +61,15 @@ export default async function LeadPage({ params }: PageProps<"/dashboard/leads/[
         <p className="whitespace-pre-line text-slate-700">{lead.message}</p>
       </section>
 
-      {lead.internalNotes && (
-        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
-          <h2 className="font-medium">Внутрішні нотатки</h2>
-          <p className="text-slate-700">{lead.internalNotes}</p>
-        </section>
-      )}
+      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
+        <h2 className="font-medium">Внутрішні нотатки</h2>
+        {lead.internalNotes ? (
+          <p className="whitespace-pre-line break-words text-slate-700">{lead.internalNotes}</p>
+        ) : (
+          <p className="text-slate-500">Нотаток ще немає.</p>
+        )}
+        <LeadNoteForm leadId={lead.id} />
+      </section>
 
       <LeadActions leadId={lead.id} status={lead.status} />
     </div>
diff --git a/lib/db.ts b/lib/db.ts
index 648645c..eb52eec 100644
--- a/lib/db.ts
+++ b/lib/db.ts
@@ -31,6 +31,7 @@ const LATENCY_MS = {
   getLead: 80,
   insertLead: 120,
   updateLeadStatus: 80,
+  appendLeadNote: 80,
   deleteLead: 80,
   insertAuditEntry: 250,
   listUsers: 50,
@@ -369,6 +370,16 @@ export const db = {
     });
   },
 
+  appendLeadNote(id: string, note: string) {
+    return query("appendLeadNote", () => {
+      const lead = store.leads.find((l) => l.id === id);
+      if (!lead) return false;
+      lead.internalNotes = lead.internalNotes ? `${lead.internalNotes}\n${note}` : note;
+      lead.updatedAt = new Date().toISOString();
+      return true;
+    });
+  },
+
   deleteLead(id: string) {
     return query("deleteLead", () => {
       const index = store.leads.findIndex((l) => l.id === id);
diff --git a/components/lead-note-form.tsx b/components/lead-note-form.tsx
new file mode 100644
index 0000000..2f9f1d0
--- /dev/null
+++ b/components/lead-note-form.tsx
@@ -0,0 +1,64 @@
+"use client";
+
+import { useActionState } from "react";
+import { addLeadNote, type AddLeadNoteState } from "@/app/actions";
+import { NOTE_MAX_LENGTH } from "@/lib/lead-note-form";
+
+const initialState: AddLeadNoteState = { status: "idle" };
+
+export function LeadNoteForm({ leadId }: { leadId: string }) {
+  const [state, formAction, pending] = useActionState(addLeadNote.bind(null, leadId), initialState);
+  const errors = state.status === "invalid" ? state.errors : {};
+  const values = state.status === "invalid" ? state.values : {};
+
+  return (
+    <form action={formAction} className="space-y-2" noValidate>
+      {state.status === "invalid" && (
+        <p role="alert" className="text-sm text-red-700">
+          Нотатку не додано: перевірте поле.
+        </p>
+      )}
+      {state.status === "error" && (
+        <p role="alert" className="text-sm text-red-700">
+          Не вдалося додати нотатку. Оновіть сторінку й спробуйте ще раз.
+        </p>
+      )}
+
+      <label htmlFor="lead-note" className="block text-sm font-medium">
+        Додати нотатку
+      </label>
+      <textarea
+        id="lead-note"
+        name="note"
+        rows={3}
+        maxLength={NOTE_MAX_LENGTH}
+        defaultValue={values.note}
+        aria-invalid={errors.note ? "true" : undefined}
+        aria-describedby={errors.note ? "lead-note-error lead-note-hint" : "lead-note-hint"}
+        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
+      />
+      {errors.note && (
+        <p id="lead-note-error" className="text-xs text-red-600">
+          {errors.note}
+        </p>
+      )}
+
+      <div className="flex items-center justify-between gap-4">
+        <p id="lead-note-hint" className="text-xs text-slate-500">
+          До {NOTE_MAX_LENGTH} символів. Бачить лише команда.
+        </p>
+        <button
+          type="submit"
+          disabled={pending}
+          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
+        >
+          {pending ? "Надсилаємо…" : "Додати нотатку"}
+        </button>
+      </div>
+
+      <p role="status" className="text-xs text-emerald-700">
+        {state.status === "ok" ? "Нотатку додано." : ""}
+      </p>
+    </form>
+  );
+}
diff --git a/lib/lead-note-form.ts b/lib/lead-note-form.ts
new file mode 100644
index 0000000..d13735f
--- /dev/null
+++ b/lib/lead-note-form.ts
@@ -0,0 +1,24 @@
+export const NOTE_MAX_LENGTH = 500;
+
+export type LeadNoteField = "note";
+
+export type LeadNoteParseResult =
+  | { ok: true; data: { note: string } }
+  | { ok: false; errors: Partial<Record<LeadNoteField, string>>; values: Partial<Record<LeadNoteField, string>> };
+
+export function parseLeadNoteForm(formData: FormData): LeadNoteParseResult {
+  const raw = formData.get("note");
+  const note = typeof raw === "string" ? raw.trim() : "";
+
+  // Reject instead of slicing: a silently cut note loses the end of what was written.
+  if (!note) return { ok: false, errors: { note: "Напишіть нотатку" }, values: { note } };
+  if (note.length > NOTE_MAX_LENGTH) {
+    return {
+      ok: false,
+      errors: { note: `Нотатка довша за ${NOTE_MAX_LENGTH} символів (зараз ${note.length})` },
+      values: { note },
+    };
+  }
+
+  return { ok: true, data: { note } };
+}
```

## `task-b/run-1/base-sha.txt`

```text
d4a9ca7
```

## `task-b/run-1/meta.txt`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high
prompt sha256: 1fb304acd6c6fb41c030b43cf34794dca34dba726129d78d85a5d69a2b6e3279
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*) --disallowedTools WebFetch,WebSearch,NotebookEdit
started: 2026-09-27T13:14:33Z
exit: 0 · wall: 102s
```

## `task-b/run-1/prompt.txt`

```text
На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
```

## `task-b/run-1/stderr.txt`

_(empty file)_

## `task-b/run-1/transcript.jsonl`

Raw stream-json transcript, only in `raw-evidence.tar.gz`. Readable form: `transcript.md` of this unit.

## `task-b/run-1/verify-invalid-stale-server.txt`

```text
# INVALID — kept on purpose. This run measured a STALE next-server (pid started 16:10:27 local, build 3d3cf84,
# before the note form existed): the script's own 'next start' failed on the busy port and it went on.
# All 500s below are that server answering an unknown action. Fixed by docs/evidence/bin/server.sh.
# Task B verify · d4a9ca7+dirty · build opprIbeHOQSCNbFmv2Av6 · pid 49340 · 2026-09-27T13:22:42Z
hidden $ACTION inputs found in server HTML: 4
```

## `task-b/run-2/agent.diff`

```diff
diff --git a/app/actions.ts b/app/actions.ts
index dac5aac..a9ed615 100644
--- a/app/actions.ts
+++ b/app/actions.ts
@@ -2,10 +2,12 @@
 
 import { headers } from "next/headers";
 import { revalidatePath } from "next/cache";
+import { after } from "next/server";
 import { db } from "@/lib/db";
 import { logAudit } from "@/lib/audit";
 import { getCurrentUser, getWorkspace } from "@/lib/data";
 import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
+import { parseLeadNoteForm, type LeadNoteFormField } from "@/lib/lead-note-form";
 import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
 
 const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";
@@ -84,6 +86,40 @@ export async function updateLeadStatus(id: string, status: LeadStatus) {
   revalidatePath(`/dashboard/leads/${id}`);
 }
 
+export type AddLeadNoteState =
+  | { status: "idle" }
+  | {
+      status: "invalid";
+      errors: Partial<Record<LeadNoteFormField, string>>;
+      values: Partial<Record<LeadNoteFormField, string>>;
+    }
+  | { status: "ok" }
+  | { status: "error" };
+
+export async function addLeadNote(
+  _prevState: AddLeadNoteState,
+  formData: FormData,
+): Promise<AddLeadNoteState> {
+  await getCurrentUser(); // no session -> redirect("/login"); kept outside try so the redirect is not swallowed
+  let leadId: string;
+  try {
+    leadId = await authorizeLead(formData.get("leadId"));
+  } catch {
+    return { status: "error" };
+  }
+
+  const parsed = parseLeadNoteForm(formData);
+  if (!parsed.ok) {
+    return { status: "invalid", errors: parsed.errors, values: parsed.values };
+  }
+
+  if (!(await db.appendLeadNote(leadId, parsed.data.note))) return { status: "error" };
+
+  after(() => logAudit("lead.note_added", leadId));
+  revalidatePath(`/dashboard/leads/${leadId}`);
+  return { status: "ok" };
+}
+
 export async function deleteLead(id: string) {
   await authorizeLead(id);
   await db.deleteLead(id);
diff --git a/app/dashboard/leads/[id]/page.tsx b/app/dashboard/leads/[id]/page.tsx
index 13b72ac..7dd540b 100644
--- a/app/dashboard/leads/[id]/page.tsx
+++ b/app/dashboard/leads/[id]/page.tsx
@@ -1,6 +1,7 @@
 import Link from "next/link";
 import { notFound } from "next/navigation";
 import { LeadActions } from "@/components/lead-actions";
+import { LeadNoteForm } from "@/components/lead-note-form";
 import { StatusBadge } from "@/components/status-badge";
 import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
 
@@ -60,12 +61,17 @@ export default async function LeadPage({ params }: PageProps<"/dashboard/leads/[
         <p className="whitespace-pre-line text-slate-700">{lead.message}</p>
       </section>
 
-      {lead.internalNotes && (
-        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
+      <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
+        <div className="space-y-2">
           <h2 className="font-medium">Внутрішні нотатки</h2>
-          <p className="text-slate-700">{lead.internalNotes}</p>
-        </section>
-      )}
+          {lead.internalNotes ? (
+            <p className="whitespace-pre-line break-words text-slate-700">{lead.internalNotes}</p>
+          ) : (
+            <p className="text-slate-500">Нотаток ще немає.</p>
+          )}
+        </div>
+        <LeadNoteForm leadId={lead.id} />
+      </section>
 
       <LeadActions leadId={lead.id} status={lead.status} />
     </div>
diff --git a/lib/db.ts b/lib/db.ts
index 648645c..eb52eec 100644
--- a/lib/db.ts
+++ b/lib/db.ts
@@ -31,6 +31,7 @@ const LATENCY_MS = {
   getLead: 80,
   insertLead: 120,
   updateLeadStatus: 80,
+  appendLeadNote: 80,
   deleteLead: 80,
   insertAuditEntry: 250,
   listUsers: 50,
@@ -369,6 +370,16 @@ export const db = {
     });
   },
 
+  appendLeadNote(id: string, note: string) {
+    return query("appendLeadNote", () => {
+      const lead = store.leads.find((l) => l.id === id);
+      if (!lead) return false;
+      lead.internalNotes = lead.internalNotes ? `${lead.internalNotes}\n${note}` : note;
+      lead.updatedAt = new Date().toISOString();
+      return true;
+    });
+  },
+
   deleteLead(id: string) {
     return query("deleteLead", () => {
       const index = store.leads.findIndex((l) => l.id === id);
diff --git a/components/lead-note-form.tsx b/components/lead-note-form.tsx
new file mode 100644
index 0000000..1b37e9c
--- /dev/null
+++ b/components/lead-note-form.tsx
@@ -0,0 +1,68 @@
+"use client";
+
+import { useActionState } from "react";
+import { addLeadNote, type AddLeadNoteState } from "@/app/actions";
+import { NOTE_MAX_LENGTH } from "@/lib/lead-note-form";
+
+const initialState: AddLeadNoteState = { status: "idle" };
+
+export function LeadNoteForm({ leadId }: { leadId: string }) {
+  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
+  const errors = state.status === "invalid" ? state.errors : {};
+  const values = state.status === "invalid" ? state.values : {};
+
+  return (
+    <form action={formAction} className="space-y-2" noValidate>
+      <input type="hidden" name="leadId" value={leadId} />
+
+      {state.status === "invalid" && (
+        <p role="alert" className="text-sm text-red-700">
+          Нотатку не збережено: перевірте поле нижче.
+        </p>
+      )}
+      {state.status === "error" && (
+        <p role="alert" className="text-sm text-red-700">
+          Не вдалося зберегти нотатку. Оновіть сторінку й спробуйте ще раз.
+        </p>
+      )}
+
+      <label htmlFor="lead-note" className="block font-medium">
+        Додати нотатку
+      </label>
+      <textarea
+        id="lead-note"
+        name="note"
+        rows={3}
+        maxLength={NOTE_MAX_LENGTH}
+        defaultValue={values.note}
+        aria-invalid={errors.note ? "true" : undefined}
+        aria-describedby={errors.note ? "lead-note-error" : "lead-note-hint"}
+        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
+      />
+      {errors.note ? (
+        <p id="lead-note-error" className="text-xs text-red-600">
+          {errors.note}
+        </p>
+      ) : (
+        <p id="lead-note-hint" className="text-xs text-slate-500">
+          До {NOTE_MAX_LENGTH} символів. Бачить лише команда.
+        </p>
+      )}
+
+      <div className="flex items-center gap-3">
+        <button
+          type="submit"
+          disabled={pending}
+          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
+        >
+          {pending ? "Надсилаємо…" : "Додати нотатку"}
+        </button>
+        {state.status === "ok" && (
+          <p role="status" className="text-sm text-emerald-700">
+            Нотатку додано.
+          </p>
+        )}
+      </div>
+    </form>
+  );
+}
diff --git a/lib/lead-note-form.ts b/lib/lead-note-form.ts
new file mode 100644
index 0000000..232de15
--- /dev/null
+++ b/lib/lead-note-form.ts
@@ -0,0 +1,25 @@
+export const NOTE_MAX_LENGTH = 500;
+
+export type LeadNoteFormField = "note";
+
+export type LeadNoteParseResult =
+  | { ok: true; data: { note: string } }
+  | {
+      ok: false;
+      errors: Partial<Record<LeadNoteFormField, string>>;
+      values: Partial<Record<LeadNoteFormField, string>>;
+    };
+
+export function parseLeadNoteForm(formData: FormData): LeadNoteParseResult {
+  const raw = formData.get("note");
+  // Textareas submit line breaks as \r\n, while the browser's maxLength counts them as one character.
+  const note = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
+
+  let error: string | undefined;
+  if (!note) error = "Напишіть текст нотатки";
+  else if (note.length > NOTE_MAX_LENGTH) error = `Не більше ${NOTE_MAX_LENGTH} символів (зараз ${note.length})`;
+
+  return error
+    ? { ok: false, errors: { note: error }, values: { note: note.slice(0, NOTE_MAX_LENGTH * 4) } }
+    : { ok: true, data: { note } };
+}
```

## `task-b/run-2/base-sha.txt`

```text
9297071
```

## `task-b/run-2/meta.txt`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high
prompt sha256: 1fb304acd6c6fb41c030b43cf34794dca34dba726129d78d85a5d69a2b6e3279
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*) --disallowedTools WebFetch,WebSearch,NotebookEdit
started: 2026-09-27T13:34:27Z
exit: 0 · wall: 125s
```

## `task-b/run-2/prompt.txt`

```text
На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
```

## `task-b/run-2/stderr.txt`

_(empty file)_

## `task-b/run-2/transcript.jsonl`

Raw stream-json transcript, only in `raw-evidence.tar.gz`. Readable form: `transcript.md` of this unit.

## `task-b/run-2/verify-browser.txt`

```text
# Task B run-2 · JS enabled · in-app browser · production build of 9297071 + run-2 diff · lead_0002 as Olena
empty submit:  aria-invalid="true", aria-describedby="lead-note-error", error text "Напишіть текст нотатки",
               role="alert" summary "Нотатку не збережено: перевірте поле нижче."
valid submit:  note "VERIFY-JS-1" shown on the page, role="status" "Нотатку додано.", textarea cleared
```

## `task-b/run-2/verify.txt`

```text
# Task B verify · 9297071+dirty · build WezUHKv0AIG2tl71k7TK_ · pid 50836 · 2026-09-27T13:37:49Z
hidden inputs in the server-rendered note form: 5 — $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY leadId
no-JS POST as owner, note 'VERIFY-NOJS-1': HTTP 200 · note on page: 2
no-JS POST as marta (other workspace), 'VERIFY-MARTA': HTTP 404 · note on page: 0
no-JS POST without cookie, 'VERIFY-ANON': HTTP 307 · note on page: 0
no-JS POST as owner, empty note: HTTP 200 · aria-invalid=true: 1 · role=alert: 1 · 'Напишіть текст нотатки': 1
no-JS POST as owner, 501 chars: HTTP 200 · error 'Не більше 500': 1 · typed text kept in textarea: 1 · saved: 0
server log lines mentioning the note text or an email/phone: 0
server log lines total: 57
```

## `task-b/verify-after-review-run-2.txt`

Після рев'ю CodeRabbit verify-note-form.sh звіряє кожен пункт (exit 1 при FAIL). Код run-2 = 9297071 + run-2/agent.diff у тимчасовому worktree:

```text
# Task B verify · 9297071+dirty · build N2ueQSLTJnfCduWGI_gqM · pid 83036 · 2026-09-27T15:18:14Z
hidden inputs in the server-rendered note form: 5 — $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY leadId
  ok   no-JS POST as owner saves the note (HTTP 200 · note on page: 2)
  ok   no-JS POST as marta (other workspace) is refused (HTTP 404 · note on page: 0)
  ok   no-JS POST without cookie is refused (HTTP 307 · note on page: 0)
  ok   empty note: accessible field error (HTTP 200 · aria-invalid=true: 1 · role=alert: 1 · 'Напишіть текст нотатки': 1)
  ok   501 chars: error, typed text kept, nothing saved (HTTP 200 · 'Не більше 500': 1 · kept in textarea: 1 · saved: 0)
  ok   server log has no note text, email or phone (matching lines: 0 of 54)
result: all Verify items hold (exit 0)
```

## `task-b/verify-after-review-run-1.txt`

Той самий скрипт на коді run-1 (d4a9ca7 + run-1/agent.diff) — очікувано FAIL на no-JS пунктах (зависання, HTTP 000):

```text
# Task B verify · d4a9ca7+dirty · build OjeiPi7yniJAEygccbgyQ · pid 82879 · 2026-09-27T15:17:05Z
hidden inputs in the server-rendered note form: 4 — $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY
  FAIL no-JS POST as owner saves the note (HTTP 000 · note on page: 2)
  ok   no-JS POST as marta (other workspace) is refused (HTTP 404 · note on page: 0)
  ok   no-JS POST without cookie is refused (HTTP 307 · note on page: 0)
  FAIL empty note: accessible field error (HTTP 000 · aria-invalid=true: 0 · role=alert: 0 · 'Напишіть текст нотатки': 0)
  FAIL 501 chars: error, typed text kept, nothing saved (HTTP 000 · 'Не більше 500': 0 · kept in textarea: 0 · saved: 0)
  ok   server log has no note text, email or phone (matching lines: 0 of 54)
result: some Verify items FAIL (exit 1)
```

## `task-b/nojs-after-review.txt`

Після рев'ю CodeRabbit `nojs-isolation.sh` підключає `server.sh` зі свого репозиторію. Перевірка на коді run-2 (`9297071` + `run-2/agent.diff`) у тимчасовому worktree; `hidden=10/2` — 5 прихованих полів, по два аргументи `curl` на кожне:

```text
# nojs-isolation.sh after the CodeRabbit fix (server.sh from this repo) · run-2 code = 9297071 + task-b/run-2/agent.diff in a temp worktree · 2026-09-27T16:43:26Z
run-2-code: hidden=10/2 HTTP 200 0.532633s
```
