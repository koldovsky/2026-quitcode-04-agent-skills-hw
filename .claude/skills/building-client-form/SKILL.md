---
name: building-client-form
description: >-
  Team pattern for forms in Next.js 16 (App Router, React 19): Server Action with session,
  permission and validation checks inside, useActionState, works without JS, accessible field
  errors, input survives an error, returns only { status, … }, no personal data in logs, slow work
  (emails, n8n, audit) in after().
  Use when creating, changing or fixing a form or its Server Action: application, quote, feedback,
  note, settings; a new field, validation, FormData, <form action>, useActionState, files
  *-form.tsx, lib/*-form.ts, actions.ts.
  Triggers: «додай форму…», «зроби форму», «форма заявки», «форма кошторису», «додай поле у форму»,
  «валідація форми», «помилки валідації не видно», «скрінрідер не читає помилки», «після помилки
  все стирається», «форма не працює без JS», «кнопка Надіслати висне», «форма довго надсилається»,
  «add a form», «contact form», «form validation errors».
  Not for the n8n webhook contract (integrating-n8n-webhooks), dashboard performance, or search and
  filters that never submit.
metadata:
  owner: Pavlo M
  version: "0.1.1"
---

# Client form: Server Action + useActionState

Every agency project starts with a form, and every form follows one pattern: the action checks
permissions itself, a screen reader hears the errors, the form works without JavaScript, and
nothing extra reaches the logs or the browser. This is the team's decision, not one option among
many: any other approach only after the human says "yes".

## When to use

- A new form or a change to an existing one: the application form (`components/lead-form.tsx`), a
  quote, feedback, a note or settings in the dashboard; a new field, a new validation rule, a new
  action in `actions.ts`.
- Complaints about a form: errors aren't visible or announced, input disappears, it doesn't work
  without JS, «Надіслати» hangs.
- **Don't** use for: client-side search and filters that don't submit (`components/lead-search.tsx`);
  action buttons without fields (`components/lead-actions.tsx`): `server-auth-actions` is enough for
  those; the n8n call contract (the `integrating-n8n-webhooks` skill); dashboard performance
  (`vercel-react-best-practices`).

## How we do it

Don't rewrite Vercel's rules; reference them by id. The rule text lives in
`.claude/skills/vercel-react-best-practices/rules/<id>.md`. Before writing code, read the Next 16
docs: `node_modules/next/dist/docs/01-app/02-guides/forms.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.

**Three files per form** (as in the application form):

- `lib/<name>-form.ts`: the field type `<Name>FormField` and a pure function
  `parse<Name>Form(formData)` → `{ ok: true, data } | { ok: false, errors, values }`. No
  `"use server"`, no `db`.
- `app/**/actions.ts` (`"use server"`): the action `submit<Name>(prevState, formData)` and the
  `<Name>State` type. A form for an existing record takes its id first:
  `submit<Name>(id, prevState, formData)`.
- `components/<name>-form.tsx` (`"use client"`): `useActionState`. A Server Component renders it
  and passes the action, already bound to the record id, as the `action` prop (step 2).

### 1. A Server Action is a public POST endpoint (`server-auth-actions`)

Anyone can call the action directly, so checks in `proxy.ts`, a layout or the page don't protect
it. The order inside the action:

```ts
export async function submitX(leadId: string, _prev: XState, formData: FormData): Promise<XState> {
  await requireLeadAccess(leadId);          // session + workspace; no session: redirect("/login")
  const parsed = parseXForm(formData);      // validation: always on the server
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };
  await db.updateX(leadId, parsed.data);    // write synchronously, BEFORE after()
  revalidatePath(`/dashboard/leads/${leadId}`);
  after(async () => { /* slow work, see step 6 */ });
  return { status: "ok" };
}
```

- Session: `getCurrentUser()` from `lib/data.ts`. Permission on the record: `requireLeadAccess(id)`
  or the same `workspaceId` check for another entity. Permissions first, then validation.
- An `id` from `.bind(null, leadId)`, `<input type="hidden">` or `formData` is user input: without
  JS a bound id travels in a hidden `$ACTION_…` field of the form. Check it in the action. A new
  record's `workspaceId` comes from the session, not from the form.
- A public form without login (like `submitLead` on `/`) skips only the session check, and the
  code has the comment `// Public form: no session by design` above the action. `workspaceId`
  comes from a server-side constant. The remaining steps are the same.

### 2. `useActionState`: the form works without JavaScript

```tsx
// app/dashboard/leads/[id]/page.tsx (Server Component): bind the record id here
<XForm action={submitX.bind(null, lead.id)} />

// components/x-form.tsx ("use client")
type XAction = (prevState: XState, formData: FormData) => Promise<XState>;

export function XForm({ action }: { action: XAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};
  return <form action={formAction} noValidate>…</form>;
}
```

- Bind the record id in the Server Component and pass the bound action as a prop. Never call
  `.bind` on the action inside the Client Component: in LeadDesk (Next.js 16.3.5) a form built that
  way hung on a no-JS submission. The action ran, but the server never sent a response
  (`docs/verification.md`, Task B). A form without a record id (like `submitLead` in
  `lead-form.tsx`) imports the action and passes it to `useActionState` directly.
- Only `<form action={formAction}>`: no `onSubmit`, `preventDefault`, `fetch` or `useState` for
  fields. Before hydration the browser sends a regular POST, and the server returns the page with
  the same state.
- Every field has a `name`: the action sees only what is in `FormData`.
- The form is in the SSR HTML: no `dynamic(…, { ssr: false })` and no rendering from `useEffect`.
- The button is `type="submit"` with `disabled={pending}` and the text «Надсилаємо…».
- `noValidate` on `<form>`, as in `lead-form.tsx`: errors come from the server in one format. Keep
  `required`, `type` and `maxLength` on the fields: they are semantics and hints, not protection.

### 3. Accessible field errors; input doesn't disappear

```tsx
{state.status === "invalid" && (
  <div role="alert">Перевірте поля: <a href="#x-email">Email</a>…</div>
)}
<label htmlFor="x-email">Email</label>
<input id="x-email" name="email" type="email" required defaultValue={values.email}
  aria-invalid={Boolean(errors.email)}
  aria-describedby={errors.email ? "x-email-error" : undefined} />
{errors.email && <p id="x-email-error">{errors.email}</p>}
```

- Every field has a visible `<label>`. A placeholder does not replace a label. `id`s are unique on
  the page (with a form prefix or `useId()`).
- The `role="alert"` summary at the top of the form links to the fields with errors.
  `status: "error"` is shown there too.
- The error text says what to fix («Перевірте email»), not "Invalid".
- React 19 resets the form after the action. So on `invalid` the action returns `values`, the text
  fields exactly as the user typed them (no passwords or files), and the fields use
  `defaultValue={values.x}` / `defaultChecked`. `<select>`, checkbox and radio don't pick up a new
  default after mount, so they also need `key={values.x ?? ""}`.

### 4. The action returns only `{ status, … }` (`server-serialization`)

- Everything the action returns is serialized into the response. Never return a row from `db`
  (`ipAddress`, `userAgent`, `rawPayload`, `internalNotes`…), not even "for convenience".
- Allowed: `status`, `errors`, `values` (an echo of the input), `message` (text for a human) and the
  `id` of a new record if the client needs a link. Or call `redirect()`.
- Failure → `{ status: "error", message: "Не вдалося зберегти. Спробуйте ще раз." }` with no
  `error.message`, stack trace or data.

### 5. No personal data in logs

- Forbidden: `console.log(formData)`, `Object.fromEntries(formData)`, `parsed.data`, the lead
  object, and a name, email, phone, message text, IP or user agent in a log, in `logAudit` or in an
  error message (``throw new Error(`… ${email}`)``).
- Allowed: the action name, the record `id` and the error type:
  `console.error("lead.note_failed", { leadId, error: error instanceof Error ? error.name : "unknown" })`.
- Audit entries are written as `logAudit("<entity>.<verb>", id)`: the action and the id only.

### 6. Slow side effects go in `after()` (`server-after-nonblocking`)

- Emails, n8n, `logAudit`, analytics and notifications go in `after()` from `next/server`. The
  action body keeps the session, permissions, validation, the `db` write, `revalidatePath` and
  `return`.
- A write without which the result would be lost happens synchronously, before `after()`.
  `after()` runs even after an error or a `redirect()`, so call it only after a successful write.
- Each effect in `after()` has its own `try/catch` with a log free of personal data (step 5): the
  user has already received "ok", and nobody would see the failure.
- Take the URL, headers, signature and retries for n8n from the `integrating-n8n-webhooks` skill.
  This skill only defines that the n8n call sits in `after()`.
- The existing `submitLead` (`app/actions.ts`) waits for n8n and the audit synchronously. It is not
  a model; fix it only when a task changes that exact action.

## Checklist

```
- [ ] 1. The action starts with getCurrentUser()/requireLeadAccess(), or has the «Public form» comment and workspaceId is a server-side constant.
- [ ] 2. Every id from bind/hidden/formData is checked in the action against the user's workspace.
- [ ] 3. Validation is in parse<Name>Form on the server; invalid data never reaches db.
- [ ] 4. <form action={formAction}>, no onSubmit/preventDefault/fetch; every field has a name; a record id is bound in the Server Component, never with .bind inside the client form.
- [ ] 5. Every field has <label htmlFor>, id, aria-invalid, aria-describedby → the id of its error text.
- [ ] 6. There is an error summary in role="alert".
- [ ] 7. Input survives an error: defaultValue from state.values; select/checkbox/radio have a key.
- [ ] 8. The action returns only the <Name>State type (status, errors, values, message, id), never a row from db.
- [ ] 9. In the changed files, no console.* / logAudit / Error contains formData or personal data.
- [ ] 10. Emails, n8n and audit are in after(), each in try/catch; the db write happens before after().
```

## Stop rules — stop and ask the human if:

- It's unclear who may perform the action (role, whose workspace) or whether the form is public.
  Don't guess, and don't remove the check.
- The task asks to return a row or a list from `db` to the browser, or to write personal data to a
  log.
- The form accepts files, passwords or payment data: this pattern doesn't cover them.
- The data structure (`lib/types.ts`, `lib/db.ts`) would change more than the task directly asks.
- A new package is needed (zod, react-hook-form…): only after the human says "yes" in chat.
- A secret or environment variable is needed that isn't in `.env.example`. Don't read `.env*`.
- An n8n call is needed, but the `integrating-n8n-webhooks` skill is missing or the contract is
  unclear: don't invent URLs or headers.

## Verify — the task is done only when:

- [ ] `npm run lint` and `npm run build` pass without errors.
- [ ] Empty submission: every required field shows its error text, with a summary in
      `role="alert"` at the top. In DevTools → Elements the field has `aria-invalid="true"` and an
      `aria-describedby` pointing to the id of its error text.
- [ ] Submission with one error (email `abc`): the rest of the input is still there, including the
      select and the checkbox.
- [ ] Without JS (DevTools → Command Menu → «Disable JavaScript», then reload): an empty
      submission, a submission with an error and a successful submission behave the same, just
      with a full page reload. If the page never comes back, check first that the action is not
      bound inside the Client Component (step 2).
- [ ] Action without a session: open the form in the dashboard, click «Вийти» in another tab, then
      submit the form in the first tab. You should land on `/login`, and the data is unchanged.
      For a public form this item doesn't apply, but the code must have the `Public form` comment.
- [ ] Server log (the `npm run dev` terminal) after an invalid and a successful submission: no
      name, email, phone, message text or IP; only the action name and the id.
- [ ] DevTools → Network → the `POST` after «Надіслати»: the response holds only `status`
      (+ `errors`/`values`/`id`), no fields from `db`. If the action sends to n8n: with the mock
      `node tools/mock-n8n.mjs --mode last-node` (it responds after 2 s) the form responds
      noticeably faster than 2 s.
