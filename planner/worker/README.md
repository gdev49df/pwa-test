# ддх воркер: ии и пуш-уведомления

прокси между приложением и groq, плюс рассылка пушей для напоминаний. ключ groq хранится только в секрете воркера, в браузер и в репозиторий он не попадает.

## как запустить (через сайт cloudflare)

1. dash.cloudflare.com → Workers & Pages → Create → Create Worker, имя `ddx-ai`, Deploy.
2. Edit code → вставь содержимое `index.js` → Deploy.
3. Settings → Variables and Secrets:
   - Secret `GROQ_API_KEY` = ключ из console.groq.com (API Keys)
   - Text `ALLOWED_ORIGINS` = `https://gdev49df.github.io`
4. скопируй адрес воркера (вида `https://ddx-ai.твой-ник.workers.dev`) и вставь в `planner/config.js` в `ai.url`.

## защита

- воркер отвечает только сайтам из `ALLOWED_ORIGINS`
- фото до 600 КБ, ответ ограничен по длине
- в приложении есть дневной лимит запросов для бесплатного тарифа (`limits.aiDay`)
- для надёжности в панели cloudflare добавь Rate limiting rule на воркер (Security → WAF → Rate limiting)
- в console.groq.com следи за лимитами ключа

## пуш-уведомления (напоминания при закрытом приложении)

нужны три вещи в cloudflare, один раз:

1. хранилище: Workers & Pages → KV → Create a namespace, имя `ddx-push`.
2. привязка: воркер `ddx-ai` → Settings → Bindings → Add → KV namespace, имя переменной строго `KV`, выбрать `ddx-push`.
3. расписание: воркер → Settings → Trigger Events → Add → Cron Trigger → `* * * * *` (каждую минуту).

потом заново вставь `index.js` в Edit code и Deploy. ключи vapid воркер создаёт сам при первом запросе и хранит в KV, ничего вводить не надо.

в приложении: добавить на экран «Домой» (iOS 16.4+), открыть Настройки → «включить пуш-уведомления» → «проверить пуш».

как это работает: при каждом изменении задач приложение отправляет воркеру список ближайших напоминаний, а cron раз в минуту шлёт пуши на те, время которых пришло. точность до минуты.
