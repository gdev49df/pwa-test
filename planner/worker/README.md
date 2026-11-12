# ддх ии-воркер

прокси между приложением и groq. ключ хранится только в секрете воркера, в браузер и в репозиторий он не попадает.

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
