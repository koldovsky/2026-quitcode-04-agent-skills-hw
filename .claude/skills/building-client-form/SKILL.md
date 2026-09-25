---
name: building-client-form
description: >-
  The team's pattern for forms in Next.js App Router projects (React 19): a Server Action that checks
  session, permissions and input itself, useActionState on the client, accessible field errors, a
  { status, ... } result instead of a database row, no personal data in logs, slow side effects in
  after(). Use when adding or changing any form or Server Action that accepts user input: a lead or
  contact form, a quote/estimate request, feedback, settings, notes or comments, or when fixing form
  validation, error display or submit speed. Triggers: «додай форму…», «форма заявки», «форма
  кошторису», «форма зворотного зв'язку», «додай поле в форму», «помилки валідації не видно»,
  «форма довго відправляється», "add a form", "contact form", "validation errors not shown".
  Not for read-only pages, search/filter inputs that do not submit to the server, or the internals
  of third-party integrations the action calls.
metadata:
  owner: studio-nova-dev
  version: "0.1.0"
---

# Building a client form

Every agency project starts with a form, and every form used to be built differently: actions without
auth checks, errors a screen reader never announces, `console.log(formData)`, users waiting for an
email to be sent. This is the one pattern for all projects.

## When to use

- Adding a form (public or behind login) or a Server Action that takes `FormData`.
- Changing validation, error display, or what happens after submit.
- **Not** for pure client-side UI state (filters, search boxes) that never reaches the server.

## How we build it

Files: `lib/<form>-form.ts` (types + `parse<Form>Form`), `app/<route>/actions.ts` (`"use server"`),
`components/<form>-form.tsx` (`"use client"`).

1. **The action is a public POST endpoint** (Vercel rule `server-auth-actions`). Inside the action,
   in this order, before any write:
   - session: resolve the user from the session cookie through the project's data layer
     (e.g. `getCurrentUser()`); no session → `{ status: "unauthorized" }` (or `redirect("/login")`).
     A proxy/layout/page check is **not** enough. Public forms skip this step on purpose — say so in
     a comment.
   - permissions: the record belongs to the user's workspace/tenant (`record.workspaceId === user.workspaceId`)
     and the role may do this; otherwise `{ status: "forbidden" }` or `notFound()`.
   - validation: parse `FormData` on the server with one `parse<Form>Form(formData)` that returns
     `{ ok: true, data } | { ok: false, errors }`. Validate the full trimmed value — report "too long"
     instead of silently cutting it with `slice()`. Client-side hints never replace this.
2. **Return only a small result** (`server-serialization`):
   ```ts
   type FormState =
     | { status: "idle" }
     | { status: "invalid"; errors: Partial<Record<Field, string>>; values: Partial<Record<Field, string>> }
     | { status: "ok"; id?: string }
     | { status: "unauthorized" | "forbidden" | "error" };
   ```
   Never return the database row. `values` echoes back only what the user typed (never passwords or
   secrets) so the form can refill itself.
3. **Client: `useActionState`** — `const [state, formAction, pending] = useActionState(action, { status: "idle" })`,
   `<form action={formAction}>`. It is a real `<form>` with `name` on every field and a
   `type="submit"` button, so it works without JavaScript (progressive enhancement). `pending` →
   disable the button and change its label.
4. **Input survives an error.** React resets the form after an action; render each field with
   `defaultValue={state.values?.x}` and put `key={JSON.stringify(state.values ?? {})}` on the `<form>`
   (or on each `<select>`) so the defaults apply again after a failed submit.
5. **Accessible errors** for every field:
   - a visible `<label htmlFor>` bound to the input `id` (no placeholder-only labels);
   - `aria-invalid={!!errors.x}` and `aria-describedby="x-error"` on the input;
   - the message in `<p id="x-error">` next to the field;
   - a summary above the form in `role="alert"` ("Check N fields") when `status === "invalid"`;
   - `required`, `type="email"`, `maxLength` as hints; the server still decides.
6. **No personal data in logs.** Log event name, record id, status, duration — never `formData`,
   field values, email, phone, message text, tokens or whole request/response bodies.
7. **Slow side effects go to `after()`** from `next/server` (`server-after-nonblocking`): emails,
   webhooks/automation calls, analytics, audit entries. The action writes the record, schedules
   `after(() => …)`, and returns at once. Only work the user must see in the response stays inline.
8. After a mutation that changes what a page shows: `revalidatePath(...)` for that page.

## Checklist

```
- [ ] 1. The action checks the session (or is marked as public on purpose) inside the action.
- [ ] 2. The action checks the record belongs to the user's workspace before writing.
- [ ] 3. All validation runs on the server in parse<Form>Form; no silent truncation.
- [ ] 4. The action returns { status, ... } only — no DB row, no internal ids the UI does not need.
- [ ] 5. Client uses useActionState; the form submits without JavaScript.
- [ ] 6. After an invalid submit every field keeps what the user typed (including <select>).
- [ ] 7. Every field has label/htmlFor, aria-invalid, aria-describedby → its error; summary has role="alert".
- [ ] 8. No console.* prints form values, personal data or bodies.
- [ ] 9. Emails, webhooks, audit and other slow work run inside after().
```

## Stop rules — stop and ask the human if:

- It is unclear **who** may submit the form (public, any member, owner only) or whose records it may touch.
- The task asks to log, return or send to the client a field with personal data or a secret.
- The user must see the result of a slow side effect (e.g. a payment or a long workflow) in the same
  response — that is a product decision, not something to solve with a long `await`.
- A new third-party service, credential or environment variable is needed for the side effect.

## Verify — the task is done only when:

- [ ] `npm run lint` and `npm run build` pass.
- [ ] Empty submit: each required field shows its message, the summary is announced (`role="alert"`),
      focus/tab order still works, and nothing typed is lost.
- [ ] With JavaScript disabled (DevTools → Disable JavaScript) the form submits and shows the same errors.
- [ ] Without a session (log out, resubmit the page from another tab, or `curl` the action without the
      cookie) the action changes nothing and returns `unauthorized`; with another workspace's record id —
      `forbidden`/not found.
- [ ] The server log for one submit has no field values, email, phone or message text.
- [ ] Submit time in DevTools → Network does not include the slow side effect (it runs in `after()`).
