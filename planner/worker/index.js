/* прокси для ddx planner: прячет ключ anthropic от браузера.
   ключ лежит только в секрете воркера ANTHROPIC_API_KEY, в репозитории его нет.
   два режима: food (фото еды -> блюда и калории) и ask (вопрос по данным пользователя). */

const API = 'https://api.anthropic.com/v1/messages';

const FOOD_SYSTEM = 'Ты определяешь еду на фото для дневника питания. Отвечай только JSON без пояснений и без markdown: '
  + '{"items":[{"name":"блюдо по-русски","grams":число,"kcal":число}],"note":"короткое замечание или пустая строка"}. '
  + 'Граммы и калории оценивай по виду порции и будь честен: это приблизительная оценка. Если на фото нет еды, верни {"items":[],"note":"еды не видно"}.';

const ASK_SYSTEM = 'Ты личный помощник в приложении-планировщике. Пользователь спрашивает про свою жизнь: задачи, встречи, еду, траты, привычки. '
  + 'Ниже его данные из приложения. Отвечай по-русски, коротко и по делу, только по этим данным. '
  + 'Если данных для ответа нет, так и скажи. Не выдумывай. Не давай медицинских и финансовых предписаний, только наблюдения и советы по организации дня.';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function reply(status, data, origin) {
  return new Response(JSON.stringify(data), { status: status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin)) });
}

async function claude(env, model, system, content, maxTokens) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model, max_tokens: maxTokens, system: system, messages: [{ role: 'user', content: content }] })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || 'https://gdev49df.github.io').split(',').map((s) => s.trim());

    // чужие сайты не могут пользоваться воркером из браузера
    if (!allowed.includes(origin)) return new Response('forbidden', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST') return reply(405, { error: 'method' }, origin);
    if (!env.ANTHROPIC_API_KEY) return reply(500, { error: 'no key' }, origin);

    const raw = await req.text();
    if (raw.length > 600000) return reply(413, { error: 'too big' }, origin);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return reply(400, { error: 'json' }, origin); }

    try {
      if (body.mode === 'food') {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
        if (!m) return reply(400, { error: 'image' }, origin);
        const text = await claude(env, env.MODEL_FOOD || 'claude-haiku-5-5', FOOD_SYSTEM, [
          { type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } },
          { type: 'text', text: 'Что на фото? Верни JSON.' }
        ], 500);
        const j = /\{[\s\S]*\}/.exec(text);
        let out = { items: [], note: '' };
        try { out = JSON.parse(j ? j[0] : text); } catch (e) { return reply(502, { error: 'parse' }, origin); }
        const items = (Array.isArray(out.items) ? out.items : []).slice(0, 8).map((x) => ({
          name: String(x.name || '').slice(0, 60), grams: Math.max(0, Math.round(Number(x.grams) || 0)), kcal: Math.max(0, Math.round(Number(x.kcal) || 0))
        })).filter((x) => x.name);
        return reply(200, { items: items, note: String(out.note || '').slice(0, 160) }, origin);
      }

      if (body.mode === 'ask') {
        const q = String(body.question || '').trim().slice(0, 500);
        const ctx = String(body.context || '').slice(0, 8000);
        if (!q) return reply(400, { error: 'question' }, origin);
        const answer = await claude(env, env.MODEL_ASK || 'claude-sonnet-5-5', ASK_SYSTEM, 'Данные пользователя:\n' + ctx + '\n\nВопрос: ' + q, 700);
        return reply(200, { answer: answer }, origin);
      }

      return reply(400, { error: 'mode' }, origin);
    } catch (e) {
      return reply(502, { error: 'upstream' }, origin);
    }
  }
};
