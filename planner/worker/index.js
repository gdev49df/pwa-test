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

/* ================= лимиты ии на сервере =================
   клиентским лимитам верить нельзя, поэтому считаем запросы здесь: отдельно вопросы и фото еды, по устройству и по дню.
   день считается по времени астаны (UTC+5, переменная TZ_OFFSET). нужен KV. */

// хеши кодов активации pro (хеш:дни). этот блок обновляет команда node tools/make-code.js, вручную не трогай
// CODES-BEGIN
const BUILTIN_CODES = '57e0a2d85c1202b8214a441964feded9d77d6989bfff4242ce78ab2ac7cb2712:31,ebfe967d4597c60d219098668225a324fd77ed5f3b79d7dd45730b31bf91ac85:31,9ee5d7c10e41e38bf4f517b8483804d87d4d624d4868513c6f1621a4c3a78349:31,d415aa890c1643e046b1af6eefe6f0db70a0c4d79a7475337adf9a10217eeace:366,be48b176c1c1d48c37ece86525164ccd6fe8f2563dd2cc6f797e6154a45956fa:366,870ef2c9437df5773a0aa05f53528f93dd995ce287d277eaa561b998cb22d57a:366,e3649ab8a6d6856d7c43e1435359b5decd16ca45e291974a9eca0fd1cf3bb53e:31,55fd1fec110dff75574854e8c442a409a30c721f20824c5f3207c79678f72e9c:31,06fcdf4f9ffd57f29865b6cb2ef034fbc7f3116a671b0a02d92ff7e31855d39d:31,a6dd3b1b669521ed56e5879377d24e8b4b52cafe831e8bf3d1d7ed3581ef8988:31,262d15a3863ed410b0895e974f4ca8742e00922d80ee11428f915eb83b3c9cdc:31,6e1ad043339ff34473e850b82bb5f0a8fb769bd349e9774736a7f934b3850243:31,380dbb6a9b393fd4ee5ab32cbf1171c73960229c3d54d375eb2cb5b2d5fdf764:31,d9a6ea9fc78e49ecf09a245208f17ea9298bb0c892d917fae7e65f1b780a513a:31,9a2cbe90825ba713e271fe2db3a19490a566f45bc18e3c1866004b9f1cea0d34:31,bd98b2118502b60584aa54a3f1e1f26ed5437d1f3af788fc485ee8c242195d9a:31,0415bb4abbb970ec94b994b22eaa5a92942085d8eb321059e999d057398b083a:31,2ffaee9c958ee93c282e48071f7d06ee2c2e99d38d3f386473274a8b5b1dc2e0:31,f0e86fc6d092de91ec4ebb90f8ae73f3b948e4232583672b2d19e41c7b5a7882:31,7a3dbca6fb55f9566e71e63af10d8ee1dd4f3f3620ea2ba6acc69aab2a5a5dff:31,fd4f5b404ad1dd56688d88d32f4bae4201e3278a48809b845394ebc3cf36553d:31,bfd390353b71a7abc71d0e2f709aae545ae6a0a73599516781af42e89abd5aac:31,7a9d9a4be90c6fb54dc1e94dd975f4adecedf2856dc1c245dd905d28cc53ddaa:31,dc33544cccb5833d7c234e39d5ed763a49c0dda0b2824c9c7b00a075258b5170:31,13e2b61b9d00d22de27434d929f860465d7411e7aa3458a023a56292e7b529bc:31,08cd3e3058880a079090e2699ae765cc81b1e1c34f09f940a0ac251e298b28c8:31,c8d24bea141e35452a6fc8131fba76d272a04a430f693ab7be88a6a413ac31f5:31,6a277d6a6e3724d994bac743298b2e0867a8d9268e311236be3d59fe470184d4:31,22d08b5c46719e203587274d1075b0acd4cdac198e6e48533e8d2c37f63d1b97:31,f6bd1235eeeccd04ded279c239d11587f21847ff8ce5117fa943430f7f0e34f7:31,628c664b941c82c6f674aa89d7c1c256b4b1f289e50f20ee45bd8b4ecc2b0110:31,8a727bf2a86129d4d13e99c925552d4b89959e4195dadfc6c316f279c14e79e8:31,333465b12df12b3cf1782d037dcac0cda18bf274e558cea2fb1c3c83639dfc96:31,dd00e4f907e3babcea0e630f9f3d789da3da7da9902f2ad1df9b31c7e5ebb36b:31,a071440088d1047c508f7c5209e4e8e2a517bf9cd27be7019f6ad5f3fbde1f71:31,4ca115b2907e81703c74c61df59bd87a144cf4cb849cef98e947d7347a8eb24b:31,194c581805e95f35d44ee4fb1b752671eea9871b62e7c29175e44fc036cd40bf:31,24b9ae4efdcfd818e5184df8240e62da7a57c793c82abf6ca8d19ef1f07e7e23:31,a35b52afa9b5b310dbe638976567b7c8e3a246e220d7b5c0c1284ef05f2bd129:31,ef55ad566975533361846b42322201f8cb547cfa7a44e5b13ba5dd3b26a8150c:31,0def9afad12df1c4ca0eabec59bfd766c398ab812d00de641ac55715a07c6387:31,5b5ad3fbde9c11577f01716efec26555976aee7f9373785066639db4139ebf8e:31,ea7a448c31d79d93a0aa61067c870010b1cdb00c0564ad92651e73a2c9933d19:31,72d965a87c5760a240398d9caa87a7b4ad7b8641a8399307541ba5e33339397d:31,02d52f963fe05bb9070214814b2be4d741393bcbfdf38f9a636c68e3d4d69a8d:31,36b4db2d3a1ba13332e9f0733a91f0a5ec28cf2b18fb825f48bc1455c2f33027:31,846e09b37c6e73bd3c56e7e11a140ac0cc16b55e9d3ccffe3bc25f9d97fd337f:31,3e8f039811079ca422c524f68269d20c5d65edd485b91e0f48fe06ca8c8abdff:31,f59677d384800df76dd3aae1513c4f6223218c19ca65929d4ff7c89217c835da:31,935bd10b10e38435aa6bc056bf3dd684c4aa5f7f0e0542a65c281a1387ae2349:31,e136b13d209e6c35b4d5fb7f5c0a33eb8a31258d1a203ffa4f4fc0d0637a6e39:31,319cf65840853eff93280e1233f4d3ce5f68bf545f76b09966754578b5a5ef4e:31,8f59944cef894f8bafb2840b34d5dbf2b03fbc454e1d6f62b0d803c8d02849f1:31,783d0c802725a646b6d88d90b2ee2746d76d13c5e01abd8e7624218a3fef6e7a:31,5cd29de500224d6f046ef13d6aa3151a188068f6776fa8886d1358cef0166e88:31,bc08a0b40db215e7dd3622beef8d644afd169b5b7d0c5c61cfe5d05edf695df3:31,57b563fe71d9aa33e0d87e37533ab517b72bd0378169fa5b1a4a8b966fd3160b:366,8557869a20386cf20793bf0035e042367e7689710af57671c0338e7a117596d8:366,abcc53f0046c746a1669e215a757eb6146bceece854d3eb1917a67f30aeea8ef:366,fb565da3df3647e0dd3eb7f5f4b31df1c81e52d7d46410c9bcfeb11463fcbe69:366,074e4654e31ed4a671854f4a2c187b33713ff7e103186b12485b48f10a778a35:366,e3b01b42228b6f547b3b5657ef6a97ac3290f933b9cf385c301687f92b99dc16:366,a4bd36543dbd644630f5a9e2ca4b6397343d16822baad8ec2179489166f43424:366,fbd859cf4a3574e8b424408a4d96f6abaf0e38b32b8e878a742f7734f6d23255:366,f7595e1039538aff676adcd54ef138304703ce0d9cc11ff3965a9a250e23308a:366,c7c19b231cbcc744e9f7b29c2af57795a04de887b368b67c9f1acf332f49f4b0:366,322629ddb6c4ef34d18748dd4ade269522ae787d62f5cde2c5901679f64c7597:366,b74cf6b8d9b231c12f906558726aeee9b5602191ac4b5a09f7e7315e1e776f7d:366,1c00a4fe62fb76bc65025e5c3aa89024ff53cd75ba4e23e6ceb5508b86c2cd10:366,b8b75c8ad779fc51e236c414295152f27bce9f464b6eba4eef7d25681ec320a7:366,61c9350edbc988a2266e765f80e88589508ff31502432d34bf42e07d8a65851c:366,e2d4018b1b1200ee412290f2c2daf516626b57ba5a20d876a15cf138320b9b11:366,19ccf615ba1659560efedc2f1bd71dfaf65035c5ef88a95d8ea8f2f3d0ea3187:366,c045b34e900fbd0b536d8f31e2f7bd5f092d39584f54f00ddd347e206fc3907b:366,201ef9aa75809aa222c55019f4ecf17d50c0d3a3fd2b440617ae05e9306766e6:366,cae053c064bdb4917b84895b0060b5971b4e2bae05b851d595fd34cf97ea0849:366';
// CODES-END

const FREE_Q = { ask: 10, food: 2 };
const PRO_Q = { ask: 40, food: 15 };
const GLOBAL_DAY = 1500;   // общий предохранитель на все запросы за день, чтобы ключ groq не улетел в минус

const dayKey = (env) => new Date(Date.now() + Number(env.TZ_OFFSET || 5) * 3600000).toISOString().slice(0, 10);
const num = (v) => Math.max(0, parseInt(v, 10) || 0);

async function sha256hex(s) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// pro: проверяем код активации (список зашит в BUILTIN_CODES, можно добавить свои в переменную PRO_CODES) и привязываем его к первому устройству.
// если список пуст, верим приложению, но лимиты pro всё равно ограничены
async function isProDevice(env, body, device) {
  const list = (BUILTIN_CODES + ',' + String(env.PRO_CODES || '')).split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return body.pro === true;
  const code = String(body.code || '').slice(0, 64);
  if (!code) return false;
  const hash = await sha256hex(code);
  const ent = list.map((x) => x.split(':')).find((x) => x[0] === hash);
  if (!ent) return false;
  const days = Number(ent[1]) || 31;
  const key = 'p:' + hash;
  let rec = null;
  try { rec = JSON.parse(await env.KV.get(key)); } catch (e) { rec = null; }
  if (!rec) { rec = { device: device, at: Date.now() }; await env.KV.put(key, JSON.stringify(rec)); }
  return rec.device === device && Date.now() < rec.at + days * 86400000;
}

// списывает одну попытку. возвращает { info, refund } или { status, payload }
async function takeQuota(env, body, kind) {
  if (!env.KV) return { info: null, refund: async () => {} };
  const device = String(body.device || '');
  if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) return { status: 400, payload: { error: 'device' } };
  const day = dayKey(env);
  const pro = await isProDevice(env, body, device);
  const cap = (pro ? PRO_Q : FREE_Q);
  const qk = 'q:' + device + ':' + day, gk = 'g:' + day;
  let q = { ask: 0, food: 0 };
  try { q = Object.assign(q, JSON.parse(await env.KV.get(qk))); } catch (e) { /* первый запрос за день */ }
  const info = () => ({ pro: pro, ask: { used: q.ask, limit: cap.ask }, food: { used: q.food, limit: cap.food } });
  if (q[kind] >= cap[kind]) return { status: 429, payload: { error: 'limit', kind: kind, quota: info() } };
  const g = num(await env.KV.get(gk));
  if (g >= GLOBAL_DAY) return { status: 503, payload: { error: 'busy', detail: 'на сегодня общий лимит ии исчерпан, попробуй завтра' } };
  q[kind]++;
  await Promise.all([env.KV.put(qk, JSON.stringify(q), { expirationTtl: 172800 }), env.KV.put(gk, String(g + 1), { expirationTtl: 172800 })]);
  // если запрос к модели не удался, попытку возвращаем
  const refund = async () => { try { q[kind] = Math.max(0, q[kind] - 1); await env.KV.put(qk, JSON.stringify(q), { expirationTtl: 172800 }); } catch (e) { /* не страшно */ } };
  return { info: info, refund: refund };
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

    let refund = async () => {};
    try {
      if (body.mode === 'food') {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
        if (!m) return reply(400, { error: 'image' }, origin);
        const tq = await takeQuota(env, body, 'food');
        if (tq.status) return reply(tq.status, tq.payload, origin);
        refund = tq.refund;
        const text = await llm(env, list(env.MODEL_FOOD, FOOD_MODELS), FOOD_SYSTEM, [
          { type: 'text', text: 'Что на фото? Верни JSON.' },
          { type: 'image_url', image_url: { url: body.image } }
        ], 800, true);
        const j = /\{[\s\S]*\}/.exec(text);
        let out = { items: [], note: '' };
        try { out = JSON.parse(j ? j[0] : text); } catch (e) { await refund(); return reply(502, { error: 'parse' }, origin); }
        const items = (Array.isArray(out.items) ? out.items : []).slice(0, 8).map((x) => ({
          name: String(x.name || '').slice(0, 60), grams: Math.max(0, Math.round(Number(x.grams) || 0)), kcal: Math.max(0, Math.round(Number(x.kcal) || 0))
        })).filter((x) => x.name);
        return reply(200, { items: items, note: String(out.note || '').slice(0, 160), quota: tq.info ? tq.info() : null }, origin);
      }

      if (body.mode === 'ask') {
        const q = String(body.question || '').trim().slice(0, 500);
        const ctx = String(body.context || '').slice(0, 8000);
        if (!q) return reply(400, { error: 'question' }, origin);
        const tq = await takeQuota(env, body, 'ask');
        if (tq.status) return reply(tq.status, tq.payload, origin);
        refund = tq.refund;
        const answer = await llm(env, list(env.MODEL_ASK, ASK_MODELS), ASK_SYSTEM, 'Данные пользователя:\n' + ctx + '\n\nВопрос: ' + q, 700, false);
        return reply(200, { answer: answer, quota: tq.info ? tq.info() : null }, origin);
      }

      return reply(400, { error: 'mode' }, origin);
    } catch (e) {
      await refund();
      return reply(502, { error: 'upstream', detail: String(e.message || e).slice(0, 220) }, origin);
    }
  },

  // cron: раз в минуту
  async scheduled(event, env, ctx) { ctx.waitUntil(runDue(env)); }
};
