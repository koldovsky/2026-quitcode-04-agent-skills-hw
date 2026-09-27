---
name: building-client-form
description: >-
  Team pattern for building or fixing a form in a Next.js 16 App Router project: a Server Action
  that checks the session, permissions and input itself, a Client Component with useActionState
  that works without JavaScript, accessible field errors, a minimal { status, … } result, no
  personal data in logs, and slow side effects moved into after().
  Use when adding, reviewing or fixing any form or Server Action behind a form: lead, contact,
  quote or estimate request, feedback, settings, note or comment forms, public or inside the dashboard.
  Triggers: "add a form", "додай форму", "форма заявки", "форма зворотного зв'язку",
  "форма кошторису", "додай поле до форми", "помилки валідації не видно",
  "форма довго думає після відправки", "форма не працює без JavaScript", "Server Action для форми".
  Not for: forms that only filter or search on the client without a Server Action, or styling-only changes.
metadata:
  owner: studio-nova-web
  version: "0.1.0"
---

# Building a client form

Every client project starts with a form. We build them one way so that each form is safe to
expose, accessible, and fast, regardless of who (or which agent) wrote it.

## When to use

- A new form or a new field in an existing one (`app/**/page.tsx` + a `"use server"` action).
- A bug in a form: errors not shown or not announced, input lost after an error, slow submit,
  a Server Action without an auth check, personal data in the server log.
- **Not**: client-only filters or search boxes without a Server Action; pure visual restyling.

## How we build it

Performance and security rules from `vercel-react-best-practices` apply; we reference them by id
and do not repeat them: `server-auth-actions`, `server-after-nonblocking`, `server-serialization`,
`rerender-no-inline-components`. Check any API against `node_modules/next/dist/docs/` first.

### 1. Parsing and validation — `lib/<form>-form.ts`

- One pure function `parse<Name>Form(formData): { ok: true; data } | { ok: false; errors; values }`.
  It trims, caps length (`.slice(0, max)`), normalises (email to lower case) and validates. No
  imports from `next/*`, no I/O — so it runs the same on every call.
- `errors` — `Partial<Record<Field, string>>`, one short human message per field, in the UI language.
- `values` — the raw submitted strings (never secrets or files), so the form can be refilled.
- Allowed values (selects, radios) are validated against the same constant the UI renders.

### 2. The Server Action — `app/<route>/actions.ts` with `"use server"`

A Server Action is a public POST endpoint: anyone can call it with any payload (`server-auth-actions`).
Inside the action, in this order:

1. **Session and permissions** — for non-public forms call the project's session helper
   (here `getCurrentUser()` from `lib/data.ts`, it redirects to `/login`) and check the user may
   touch this record (e.g. `lead.workspaceId === workspace.id`). Never trust ids from hidden inputs
   or from the client alone. Public forms (site lead form) skip the session but still validate.
2. **Validation** — `parse<Name>Form(formData)`; on failure
   `return { status: "invalid", errors, values }`.
3. **The write** — store only the fields the feature needs.
4. **Slow side effects in `after()`** from `next/server` — emails, audit log, analytics, n8n or
   other webhooks (`server-after-nonblocking`). The user does not wait for them; errors inside
   `after()` are caught and logged without personal data.
5. `revalidatePath(...)` for pages that show the data.
6. **Return only `{ status, … }`** — e.g. `{ status: "ok" }` or `{ status: "ok", id }`. Never the
   database row: the return value is serialized to the browser (`server-serialization`,
   Next.js `data-security.md`).

State type — a discriminated union, and the action signature is `(prevState, formData)`:

```ts
export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteField, string>>; values: Partial<Record<NoteField, string>> }
  | { status: "ok" }
  | { status: "error"; message: string }; // unexpected failure, generic text only
```

### 3. The form — Client Component with `useActionState`

- `const [state, formAction, pending] = useActionState(action, { status: "idle" })` and
  `<form action={formAction}>`. The `action` is a Server Action, so the form **also works without
  JavaScript** (progressive enhancement): no `onSubmit` + `fetch`, no `e.preventDefault()`.
- Keep the component that holds the `<form>` small; the page around it stays a Server Component.
- Every field has a visible `<label htmlFor>` (or wraps the input) and a `name`.
- On error, per field: `aria-invalid="true"`, `aria-describedby="<field>-error"`, and the message
  in `<p id="<field>-error">`. Above the form a summary `<div role="alert">` with the number of
  errors (links to fields are a plus). Focus is not stolen on every keystroke.
- **Input is not lost after an error**: React resets the form after the action, so render
  `defaultValue={state.status === "invalid" ? state.values.<field> : undefined}` (and
  `defaultChecked` for checkboxes). A changing `key` on `<form>` is the simplest way to re-apply defaults.
- HTML constraints (`required`, `maxLength`, `type="email"`) mirror the server rules but never
  replace them.
- Submit button: `disabled={pending}` and a pending label; success replaces the form or shows a
  `role="status"` message.

### 4. Logging

- **No personal data in logs**: no `console.log(formData)`, no `Object.fromEntries(formData)`, no
  name, email, phone, IP, message text, raw payloads. Log the event, the record id, the status and
  the duration.
- Errors: log `error.name`/`error.message` from your own code; do not log request bodies.

## Checklist

```
- [ ] 1. Parsing/validation is a pure function; it returns errors and values.
- [ ] 2. The action checks session and permissions inside itself (public form: validation only).
- [ ] 3. The action returns only { status, … } — no database row, no internal ids of other records.
- [ ] 4. Emails, audit, analytics, webhooks run in after(); the response does not wait for them.
- [ ] 5. useActionState + <form action>; no onSubmit/fetch; the form submits with JS disabled.
- [ ] 6. Labels, aria-invalid, aria-describedby, role="alert" summary; input survives an error.
- [ ] 7. No console.log of form data or personal data anywhere in the change.
```

## Stop and ask a human if

- the form needs a new npm dependency (form or validation libraries) — we use none by default;
- you would have to skip the session/permission check ("the page is already protected" is not a reason);
- the action would have to return or log personal data, secrets or a full database row;
- a slow side effect must finish **before** the user sees the answer (it changes the contract);
- the form sends data to an external system and the project has a skill or docs for that
  integration — follow that skill instead of inventing the call.

## Verify — the task is done only when

- [ ] `npm run lint` and `npm run build` pass.
- [ ] Empty submit: every required field shows its message, the summary is announced
      (`role="alert"`), typed values stay in the fields.
- [ ] Submit with JavaScript disabled (DevTools → Disable JavaScript, or
      `curl` the page and post the form): the action runs, the page shows the result or errors.
- [ ] Calling the action without a session (logged out, or POST without the cookie) does not
      write anything and leads to `/login` or an error state.
- [ ] Server log after a submit: only event, id, status, duration — no names, emails, phones or bodies.
- [ ] Response time of the submit (DevTools → Network) does not include emails/webhooks.
