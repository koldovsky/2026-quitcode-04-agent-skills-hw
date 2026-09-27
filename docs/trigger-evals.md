# Тест спрацювання `integrating-n8n-webhooks` (Task E2, бонус)

**Питання:** чи вмикається скіл сам, лише за `description`, на звичайні формулювання команди, і чи не
вмикається на схожі запити, які йому не належать.

## Як проведено

- **Сесії:** 12 нових headless-сесій Claude Code 2.1.282, `opus` (`claude-opus-5-5`), `--effort high`. Обв'язка
  [`run-readonly-session.sh`](evidence/bin/run-readonly-session.sh): `--setting-sources project --strict-mcp-config`,
  `--allowedTools Skill,Read,Grep,Glob`, `--disallowedTools Edit,Write,NotebookEdit,Bash`. Агент міг лише читати.
- **Копія:** `~/leaddesk-ab/leaddesk-trig`, `git archive` коміту `2f4fa4f` без `tools/`, `materials/`, `docs/`,
  `README.md`, `.coderabbit.yaml`, `.github/`. n8n-скіл у копії — версії 0.1.0. У v0.1.1 `description` не
  змінювався: `git diff 2f4fa4f HEAD -- .claude/skills/integrating-n8n-webhooks/SKILL.md` показує лише рядок
  `version`, тож результат стосується й поточної версії. Скілів у ній **три**: `integrating-n8n-webhooks`,
  `building-client-form`, `vercel-react-best-practices`. Так тест бачить і конкуренцію між скілами, а не лише
  «скіл або нічого». `init.skills` у кожному транскрипті містить `integrating-n8n-webhooks`: скіл був
  доступний у всіх 12 сесіях.
- **Критерій «спрацював»:** у транскрипті є виклик інструмента `Skill` з `integrating-n8n-webhooks`. Окремо
  перевірено, що негативні запити не читали файлів скіла напряму через `Read`.
- **Запити:** 12 файлів `task-e/prompts/*.txt`, по одному на сесію. Це розділи [`task-e/summary.md`](evidence/task-e/summary.md). Звіт по кожній сесії —
  `session-report.mjs`, тексти й повні транскрипти — у [`task-e/summary.md`](evidence/task-e/summary.md) і
  `raw-evidence.tar.gz`.

## Результати

| # | Запит (скорочено) | Має спрацювати | `Skill` у транскрипті | Вердикт |
|---|---|---|---|---|
| pos-1 | «лід треба відправляти в n8n… Як це правильно зробити в нашому проєкті?» | так | `integrating-n8n-webhooks` (перший виклик), + `references/` | ✅ |
| pos-2 | «n8n повертає 403 на наш вебхук lead-created… причина?» | так | `integrating-n8n-webhooks`, + `references/` | ✅ |
| pos-3 | «ендпоінт, на який n8n постукає, коли закінчить генерувати звіт… що перевіряти?» | так | `integrating-n8n-webhooks`, + `references/` | ✅ |
| pos-4 | «Які змінні середовища треба додати в .env.example… до n8n?» | так | `integrating-n8n-webhooks`, + `references/` | ✅ |
| pos-5 | «Воркфлоу розсилки… хвилину-дві… форма висить… 524» | так | `integrating-n8n-webhooks`, + `references/` | ✅ |
| pos-6 | «чи виклик n8n у app/actions.ts відповідає нашим домовленостям» | так | `integrating-n8n-webhooks` | ✅ |
| neg-1 | «JavaScript для вузла Code в n8n…» | ні | немає, відповідь без жодного інструмента | ✅ |
| neg-2 | «Schedule Trigger… щопонеділка о 9:00» | ні | немає | ✅ |
| neg-3 | «експортувати воркфлоу n8n у JSON і імпортувати» | ні | немає | ✅ |
| neg-4 | «Підключи Zapier… що треба з нашого боку?» | ні | немає: 2 `Glob` і 4 `Read` по коду, потім відповідь | ✅ |
| neg-5 | «форма, щоб менеджер міг змінити телефон ліда» | ні (це `building-client-form`) | `building-client-form` | ✅ |
| neg-6 | «Дашборд лідів відкривається повільно» | ні | немає | ✅ |

**Разом: 12/12.** 6 з 6 позитивних спрацювали, у 6 з 6 негативних скіл не вмикався. У pos-1…pos-6 `Skill` був
**першим** інструментом сесії, ще до читання коду.

## Що це доводить і чого ні

- `description` розводить сусідні теми. Три негативні запити (neg-1…neg-3) говорять про n8n, але про редактор і
  вузли, а не про код застосунку. Їх відсік рядок «Не для: … коду для вузла Code в n8n, імпорту/експорту JSON».
  Запит про форму (neg-5) пішов у `building-client-form`, хоча в описі n8n-скіла теж є «форма… що відправляє
  в n8n».
- **Слабке місце тесту:** частина позитивних запитів близька до фраз з `description`. pos-2 («n8n повертає
  403») і pos-5 («524», «хвилину») майже дослівні, neg-1…neg-4 — це пункти «Не для». Справді перефразовані
  pos-1, pos-3, pos-4 і pos-6. Сильніший тест — запити від людей, які опису не читали.
- **Побічне спостереження, не про цей скіл:** на neg-6 (повільний дашборд) агент не викликав
  `vercel-react-best-practices` і просто прочитав код. Перевірити спрацювання скіла Vercel було б окремим тестом.
- По одній сесії на запит, одна модель. Ймовірність спрацювання на межових формулюваннях це не вимірює.
