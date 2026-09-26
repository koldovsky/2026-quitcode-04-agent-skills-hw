# Перевірка (Task A–C, бонус E3)

> Скопіюйте в `docs/verification.md` і заповніть. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code (desktop app) · Sonnet 5
- **ОС і термінал, Node:** Windows 11 · Git Bash · Node ≥ 20.9 (з `package.json` engines)

## Скіли видно у свіжій сесії

- Як перевіряли: нова сесія Claude Code (desktop app), відкрита саме в теці
  `D:\Work\Github\2026-quitcode-04-agent-skills-hw` (окремо від сесії, де скіл встановлювався),
  запит «Чи є в `.claude/skills/` якісь власні skills цього проєкту?» — `claude -p "/context"`
  недоступний: бінарник `claude` CLI не на `PATH` у цьому середовищі (використовується лише
  desktop-застосунок).

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project (`.claude/skills/vercel-react-best-practices/`) | Сесія сама визначила його як «завендорений сторонній», не власний скіл проєкту — за коммітом `5a201d9 skills: vendor vercel-react-best-practices pinned to agent-skills-063bee9` |
| `building-client-form` | — | ще не створено (Task B) |
| `integrating-n8n-webhooks` | — | ще не створено (Task C) |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки:
  не перевірялось окремо на цьому кроці — буде перевірено перед прогонами Task D
  (`ls ~/.claude/skills ~/.cursor/skills ~/.agents/skills ~/.codex/skills`), де це критично для
  чистоти A/B.

## Task A — виправлення за скілом Vercel

Рев'ю зробив субагент (свіжий контекст) за запитом, близьким до прикладу з інструкції: «Зроби рев'ю
app/, components/, lib/ за скілом vercel-react-best-practices. Для кожної проблеми — рядок таблиці:
файл:рядок | id правила | що не так | виправлення для Next.js 16. Файли не змінюй.» — з додатковою
вимогою звірити кожну пораду з `node_modules/next/dist/docs/` нашої версії (16.3.5) перед тим, як
пропонувати її як застосовну. Знайдено 7 порушень у 5 категоріях правил; застосовано 2.

**Як міряли (для виправлення з числами):** продакшн-збірка (`npm run build && npm start -- -p
3001`, окремий порт, щоб не займати dev-сервер користувача); cookie сесії демо-користувача Olena
(`leaddesk_session=demo-u_olena`); один прогрівний запит `curl -b "$C" http://localhost:3001/dashboard`,
далі очищення лог-файлу сервера і рівно один вимірюваний запит; лічильники `db:<запит>` рахувались
через `grep -c` по логу між очищенням і виміром.

| Правило (id) | Коміт | Файли | Що змінилось | Було | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `server-cache-react` | `4c644c9` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` обгорнуто в `cache()`; `getWorkspace` тепер приймає рядок `slug` замість інлайн-об'єкта `{ slug }` (об'єкт — нова ідентичність щоразу, тому `cache()` не спрацьовував) | `db:getUserBySession` = 3, `db:getWorkspace` = 3 за один запит `/dashboard` | `db:getUserBySession` = 1, `db:getWorkspace` = 1 | лічильники `db:…` у логу продакшн-сервера на один `curl /dashboard` (до і після — окремі прогони з чистим логом) |
| `server-serialization` | `cd54048` | `lib/types.ts`, `components/leads-table.tsx`, `app/dashboard/page.tsx` | У `LeadsTable` («use client») передавався повний `Lead[]` (email, phone, `internalNotes`, `ipAddress`, `userAgent`, `rawPayload` з UTM/gclid/fbclid, `consentMarketing`, `budget`, `message`…) для всіх 200 лідів, хоч рендериться лише 5 полів. Додано `LeadSummary` (`Pick` цих 5 полів) і мапінг перед передачею в компонент | (без заміру чисел — перевірено бінарно) | `grep -o "internalNotes\|rawPayload\|ipAddress\|userAgent"` по HTML і RSC-відповіді `/dashboard` — 0 збігів після фіксу | те саме `curl`, з `\| grep -o … \| sort \| uniq -c` замість `wc -c` |

- Чому обрали для заміру саме `server-cache-react`: ефект — точне ціле число (кількість викликів
  `db:<запит>`), яке легко зняти одним `curl` і `grep -c` без парсингу HTML; дає однозначний
  до/після без шуму вимірювання часу (мережа, JIT-прогрів тощо).
- `server-serialization` (друге виправлення): не вимірювали числами розмір payload (для одного
  заміру з таблиці Task A досить одного), але перевірили бінарно — цільові поля зникли з HTML і
  RSC-відповіді повністю (0 збігів `grep`), при цьому дані, потрібні `LeadSearch`, і далі йдуть
  окремим шляхом через `/api/leads`, який їх і так уже звужував.
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували (розбіжність версії):
  `bundle-barrel-imports` для іменованих імпортів з `recharts` у `components/sources-chart.tsx` —
  за замовчуванням `recharts` вже входить у список `optimizePackageImports` Next.js 16.3.5
  (`node_modules/next/dist/docs/.../optimizePackageImports.md`), тобто фреймворк сам оптимізує ці
  імпорти без втручання; застосування поради додало б код, який нічого не змінює на практиці.
  Записано в `docs/skill-review.md`, розділ 5.
- Порада, яку розглянули, але свідомо не застосували (не через версію, а через масштаб): дублювання
  ще й у `getLeads`/`getLeadStats`/`getSourceBreakdown` (правило `async-parallel`, послідовні
  `await` замість `Promise.all`) — реальна знахідка, але залишена за межами двох обраних виправлень,
  щоб не розширювати діф понад необхідне; занотовано для можливого майбутнього виправлення.
- `npm run lint`, `npm run build` після кожного з двох виправлень: обидва пройшли без помилок
  (build — Turbopack, TypeScript-перевірка, генерація сторінок — успішно на обох прогонах).

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо):
  > <запит>
- Чи спрацював скіл і як це видно: <виклик `Skill` з `building-client-form` / читання `SKILL.md` / ні>
- Якщо не з першого разу — що змінили в `description`, і результат другої спроби: <…>
- Що зроблено (файли): <…>
- Пункти Verify зі скіла — результат кожного: <…>

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому): <…>
- Правила зупинки — перелік: <…>
- SHA коміту зі скілом (BASE для Task D): <…>
- Що скіл змінив у собі після прогонів (коміти й чому): <… або «нічого»>

**`check-contract.mjs` на коді `main`** (id + PASS/FAIL, код виходу):

```
<вивід>
```

**За бажанням: що скрипт побачив на навмисно поганому коді** (яку перевірку ламали, що вона
сказала). До рубрики це не входить, але бали знімає скрипт, який завжди PASS:

```
<вивід>
```

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
<вивід>
```

**Додатково (за бажанням):** матриця колбеків (`send-signed-callback.mjs`): випадок → очікуваний код → отриманий код.

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
