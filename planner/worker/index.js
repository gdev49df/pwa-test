/* воркер ddx planner.
   1) прокси к groq: прячет ключ от браузера. ключ лежит только в секрете GROQ_API_KEY, в репозитории его нет.
      режимы: food (фото еды -> блюда и калории) и ask (вопрос по данным пользователя).
   2) пуш-уведомления для напоминаний на iphone, когда приложение закрыто.
      приложение присылает сюда список ближайших напоминаний, а cron каждую минуту рассылает те, что подошли.
      хранилище: KV-привязка KV, ключи vapid генерируются сами при первом запросе. */

const API = 'https://api.groq.com/openai/v1/chat/completions';

const FOOD_SYSTEM = 'Ты определяешь еду на фото для дневника питания. Отвечай только JSON без пояснений и без markdown: '
  + '{"items":[{"name":"блюдо по-русски","grams":число,"kcal":число}],"note":"короткое замечание или пустая строка"}. '
  + 'Граммы и калории оценивай по виду порции и будь честен: это приблизительная оценка. Если на фото нет еды, верни {"items":[],"note":"еды не видно"}.';

const ASK_SYSTEM = 'Ты личный помощник в приложении-планировщике. Пользователь спрашивает про свою жизнь: задачи, встречи, еду, траты, привычки. '
  + 'Ниже его данные из приложения. Отвечай по-русски, коротко и по делу, только по этим данным. '
  + 'Если данных для ответа нет, так и скажи. Не выдумывай. Не давай медицинских и финансовых предписаний, только наблюдения и советы по организации дня.';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function reply(status, data, origin) {
  return new Response(JSON.stringify(data), { status: status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin)) });
}

// groq: формат как у openai chat completions.
// модели пробуются по очереди: если одна недоступна на ключе (404/400/403), берётся следующая
const ASK_MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const FOOD_MODELS = ['qwen/qwen3.8-27b', 'meta-models/muse-spark-open'];
const list = (v, def) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : def);

async function llm(env, models, system, userContent, maxTokens, json) {
  let last = null;
  for (const model of models) {
    const body = { model: model, max_tokens: maxTokens, temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
    if (json) body.response_format = { type: 'json_object' };
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + env.GROQ_API_KEY }, body: JSON.stringify(body) });
    if (!r.ok) {
      let msg = '';
      try { const e = await r.json(); msg = (e.error && e.error.message) || ''; } catch (x) { /* тела нет */ }
      last = new Error('groq ' + r.status + ' (' + model + ')' + (msg ? ': ' + msg.slice(0, 140) : ''));
      if (r.status === 404 || r.status === 400 || r.status === 403 || r.status === 429) continue;
      throw last;
    }
    const j = await r.json();
    const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    // у некоторых моделей в ответе есть блок рассуждений, его не показываем
    const clean = String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (clean) return clean;
    last = new Error('groq: пустой ответ (' + model + ')');
  }
  throw last || new Error('groq: нет моделей');
}


/* ================= web push (vapid + aes128gcm, rfc 8291) ================= */

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode.apply(null, Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; a.forEach((x) => { o.set(x, p); p += x.length; }); return o; };

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, k, len * 8));
}

async function encryptPayload(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const prk = await hkdf(auth, secret, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = cat(enc.encode(text), new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
  return cat(salt, new Uint8Array([0, 0, 16, 0, 65]), asPub, ct);
}

async function vapidJwt(aud, vapid, subject) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + claims)));
  return head + '.' + claims + '.' + b64u(sig);
}

async function sendPush(env, vapid, sub, payload) {
  const url = new URL(sub.endpoint);
  const jwt = await vapidJwt(url.origin, vapid, env.VAPID_SUBJECT || 'https://gdev49df.github.io');
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '3600', 'Urgency': 'high', 'Authorization': 'vapid t=' + jwt + ', k=' + vapid.pub },
    body: await encryptPayload(sub, JSON.stringify(payload))
  });
  return r.status;
}

// пушить можно только на адреса настоящих push-сервисов
function goodEndpoint(ep) {
  try {
    const u = new URL(ep);
    return u.protocol === 'https:' && (u.hostname.endsWith('.push.apple.com') || u.hostname === 'fcm.googleapis.com' || u.hostname.endsWith('.push.services.mozilla.com') || u.hostname.endsWith('.notify.windows.com'));
  } catch (e) { return false; }
}

async function subId(endpoint) {
  return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(endpoint)))).slice(0, 24);
}

async function loadDb(env) {
  const raw = env.KV ? await env.KV.get('db') : null;
  let db = {};
  try { db = raw ? JSON.parse(raw) : {}; } catch (e) { db = {}; }
  if (!db.subs) db.subs = {};
  if (!db.vapid) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    db.vapid = { pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))), priv: await crypto.subtle.exportKey('jwk', kp.privateKey) };
    await env.KV.put('db', JSON.stringify(db));
  }
  return db;
}
const saveDb = (env, db) => env.KV.put('db', JSON.stringify(db));

// каждую минуту: рассылаем напоминания, время которых пришло
async function runDue(env) {
  if (!env.KV) return;
  const now = Date.now();
  let db = await loadDb(env);
  const sent = [];   // [subId, key]
  const dead = [];
  for (const id of Object.keys(db.subs)) {
    const rec = db.subs[id];
    for (const it of rec.items || []) {
      if (it.ts > now) continue;
      const key = it.id + ':' + it.ts;
      if (now - it.ts < 24 * 3600000 && !(rec.sent && rec.sent[key])) {
        let st = 0;
        try { st = await sendPush(env, db.vapid, rec.sub, { title: it.title, body: it.body, tag: it.id }); } catch (e) { st = 0; }
        if (st === 404 || st === 410) { dead.push(id); break; }
      }
      sent.push([id, key]);
    }
  }
  if (!sent.length && !dead.length) return;
  db = await loadDb(env);   // свежая копия: пока слали, приложение могло прислать новые данные
  dead.forEach((id) => { delete db.subs[id]; });
  sent.forEach(([id, key]) => {
    const rec = db.subs[id]; if (!rec) return;
    rec.sent = rec.sent || {}; rec.sent[key] = now;
    rec.items = (rec.items || []).filter((x) => x.id + ':' + x.ts !== key);
  });
  Object.values(db.subs).forEach((rec) => { Object.keys(rec.sent || {}).forEach((k) => { if (now - rec.sent[k] > 2 * 86400000) delete rec.sent[k]; }); });
  await saveDb(env, db);
}

async function pushRoute(req, env, path, origin) {
  if (!env.KV) return reply(500, { error: 'no kv', detail: 'в воркере нет привязки KV' }, origin);
  if (path === '/push/key') { const db = await loadDb(env); return reply(200, { key: db.vapid.pub }, origin); }
  if (req.method !== 'POST') return reply(405, { error: 'method' }, origin);
  const raw = await req.text();
  if (raw.length > 60000) return reply(413, { error: 'too big' }, origin);
  let body; try { body = JSON.parse(raw); } catch (e) { return reply(400, { error: 'json' }, origin); }
  const sub = body.sub;
  if (!sub || !goodEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return reply(400, { error: 'sub' }, origin);
  const id = await subId(sub.endpoint);
  const db = await loadDb(env);

  if (path === '/push/test') {
    const st = await sendPush(env, db.vapid, sub, { title: 'DDX Planner', body: 'Пуш-уведомления работают', tag: 'test' });
    return reply(st >= 200 && st < 300 ? 200 : 502, { status: st }, origin);
  }
  if (path === '/push/off') { delete db.subs[id]; await saveDb(env, db); return reply(200, { ok: true }, origin); }
  if (path === '/push/sync') {
    const old = db.subs[id] || {};
    const sentMap = old.sent || {};
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40).map((x) => ({
      id: String(x.id || '').slice(0, 40), ts: Math.round(Number(x.ts) || 0), title: String(x.title || '').slice(0, 120), body: String(x.body || '').slice(0, 160)
    })).filter((x) => x.id && x.ts > 0 && !sentMap[x.id + ':' + x.ts]);
    if (Object.keys(db.subs).length > 200 && !db.subs[id]) return reply(429, { error: 'full' }, origin);
    db.subs[id] = { sub: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } }, items: items, sent: sentMap, at: Date.now() };
    await saveDb(env, db);
    return reply(200, { ok: true, count: items.length }, origin);
  }
  return reply(404, { error: 'path' }, origin);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || 'https://gdev49df.github.io').split(',').map((s) => s.trim());

    // чужие сайты не могут пользоваться воркером из браузера
    if (!allowed.includes(origin)) return new Response(JSON.stringify({ error: 'origin ' + origin + ' не разрешён' }), { status: 403, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin || '*')) });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const path = new URL(req.url).pathname;
    if (path.indexOf('/push/') === 0) {
      try { return await pushRoute(req, env, path, origin); } catch (e) { return reply(502, { error: 'push', detail: String(e.message || e).slice(0, 200) }, origin); }
    }
    if (req.method !== 'POST') return reply(405, { error: 'method' }, origin);
    if (!env.GROQ_API_KEY) return reply(500, { error: 'no key', detail: 'в воркере нет секрета GROQ_API_KEY' }, origin);

    const raw = await req.text();
    if (raw.length > 600000) return reply(413, { error: 'too big' }, origin);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return reply(400, { error: 'json' }, origin); }

    try {
      if (body.mode === 'food') {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
        if (!m) return reply(400, { error: 'image' }, origin);
        const text = await llm(env, list(env.MODEL_FOOD, FOOD_MODELS), FOOD_SYSTEM, [
          { type: 'text', text: 'Что на фото? Верни JSON.' },
          { type: 'image_url', image_url: { url: body.image } }
        ], 800, true);
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
        const answer = await llm(env, list(env.MODEL_ASK, ASK_MODELS), ASK_SYSTEM, 'Данные пользователя:\n' + ctx + '\n\nВопрос: ' + q, 700, false);
        return reply(200, { answer: answer }, origin);
      }

      return reply(400, { error: 'mode' }, origin);
    } catch (e) {
      return reply(502, { error: 'upstream', detail: String(e.message || e).slice(0, 220) }, origin);
    }
  },

  // cron: раз в минуту
  async scheduled(event, env, ctx) { ctx.waitUntil(runDue(env)); }
};
