<!-- Заголовок PR: WS4: <Ім'я Прізвище> -->

## Учасник

**Ім'я та Прізвище:**

<!-- ⚠️ ОБОВ'ЯЗКОВЕ ПОЛЕ. Впишіть повне ім'я, напр.: Олена Петренко.
     GitHub-логін не завжди дозволяє вас ідентифікувати, а сертифікат
     виписується на реальне ім'я. -->

**Основний інструмент:** <!-- Claude Code чи Cursor, версія, модель -->

## Що зроблено (Definition of Done)

- [ ] **Task A:** `docs/skill-review.md` — рев'ю до встановлення; `vercel-react-best-practices` встановлено з закріпленим тегом і `--copy`, 75 файлів і `skills-lock.json` у git; ≥ 3 виправлення — окремі коміти з id правила, числа до/після в `docs/verification.md`
- [ ] **Task B:** `.claude/skills/building-client-form/SKILL.md`; спрацювання на звичайний запит у свіжій сесії — у `docs/verification.md`
- [ ] **Task C:** `.claude/skills/integrating-n8n-webhooks/` — `SKILL.md`, `references/`, `scripts/check-contract.mjs` (≥ 5 перевірок); «запит на кошторис» працює з моком; запит, вивід `check-contract.mjs` і журнал мока — у `docs/verification.md`
- [ ] **Task D:** `docs/ab-validation.md` з обома прогонами (A — без скіла, B — зі скілом)
- [ ] **Task E (bonus):** <!-- E1 рев'ю n8n-скілів / E2 тест спрацювання / E3 Cursor — або приберіть пункт -->
- [ ] У трьох скілів `name` = назва теки, є `description`
- [ ] `npm run build` і `npm run lint` без помилок; `check-contract.mjs` на фінальному коді — 0 FAIL
- [ ] Жодних секретів у git (лише `.env.example` зі значеннями `change-me-…`); `tools/**` і `materials/**` не змінені

## Яке правило Vercel дало найбільший ефект

<!-- правило, число до → після, як міряли -->

## Що показала A/B-перевірка

<!-- коротко: A (без скіла) → B (зі скілом), або чесне «різниці немає» і чому -->

---
CodeRabbit зробить рев'ю. Якщо воно не з'явилося за кілька хвилин — додайте коментар `@coderabbitai review`.
Інші команди: `@coderabbitai summary`, `@coderabbitai help`.
