/* аккаунты: регистрация и вход по логину и паролю, облачная копия данных, Pro на аккаунте.
   токен лежит в localStorage (ddx-acc), данные приложения целиком синхронизируются с базой D1 через воркер */
(function () {
  'use strict';
  const D = window.DDX;
  const { h, $, L } = D;
  const toast = (t) => D.toast && D.toast(t);
  const label = (t) => h('p', { class: 'label', text: t });

  /* ---------- синхронизация ---------- */

  let applying = false, syncing = false, timer = 0, tooBigShown = false;

  // что уходит в облако: всё, кроме Pro (его хранит сервер) и тяжёлых фото еды
  function docOf() {
    const doc = JSON.parse(JSON.stringify(D.S));
    delete doc.pro;
    (doc.meals || []).forEach((m) => { delete m.photo; });
    return JSON.stringify(doc);
  }

  function localPhotos() {
    const map = {};
    (D.S.meals || []).forEach((m) => { if (m.photo) map[m.id] = m.photo; });
    return map;
  }

  // заменяем состояние данными из облака; Pro и фото остаются свои
  function applyDoc(json) {
    let raw;
    try { raw = JSON.parse(json); } catch (e) { return false; }
    const photos = localPhotos(), pro = D.S.pro;
    const next = D.fromRaw(raw);
    next.pro = pro;
    (next.meals || []).forEach((m) => { if (photos[m.id]) m.photo = photos[m.id]; });
    applying = true;
    try { D.S = next; D.save(); } finally { applying = false; }
    return true;
  }

  // при конфликте: объединяем списки по id, свои значения важнее
  function mergeDocs(localJson, serverJson) {
    const l = JSON.parse(localJson), s = JSON.parse(serverJson);
    const hasId = (a) => a.every((x) => x && typeof x === 'object' && x.id != null);
    const out = Object.assign({}, s);
    Object.keys(l).forEach((k) => {
      const a = l[k], b = s[k];
      if (Array.isArray(a) && Array.isArray(b) && hasId(a) && hasId(b)) {
        const ids = new Set(a.map((x) => x.id));
        out[k] = a.concat(b.filter((x) => !ids.has(x.id)));
      } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        out[k] = Object.assign({}, b, a);
      } else out[k] = a;
    });
    return JSON.stringify(out);
  }

  const mark = (patch) => { const a = D.acc.get(); if (a) D.acc.set(Object.assign({}, a, patch)); };

  async function push(force) {
    const a = D.acc.get();
    if (!a || !a.token || syncing || !D.aiOn()) return;
    syncing = true;
    try {
      let json = docOf();
      if (json.length > 900000) {
        if (!tooBigShown) { tooBigShown = true; toast('данных слишком много для облака'); }
        return;
      }
      let r = await D.api('data/put', { json: json, base: a.base || 0, force: !!force });
      if (r.status === 409 && r.j.json) {
        // с другого устройства уже пришли изменения: объединяем и отправляем
        const merged = mergeDocs(json, r.j.json);
        applyDoc(merged);
        json = docOf();
        r = await D.api('data/put', { json: json, base: r.j.updated, force: false });
        if (D.render) D.refresh();
      }
      if (r.ok) mark({ base: r.j.updated, dirty: false, at: Date.now() });
    } catch (e) { /* нет сети: повторим при следующем изменении */ } finally { syncing = false; }
  }

  function syncSoon() {
    clearTimeout(timer);
    timer = setTimeout(() => { push(false); }, 3000);
  }

  D.onSave = () => {
    if (applying) return;
    const a = D.acc.get();
    if (!a || !a.token) return;
    if (!a.dirty) mark({ dirty: true });
    syncSoon();
  };

  // забираем облачную версию, если она новее и на телефоне нет несохранённых правок
  async function pull() {
    const a = D.acc.get();
    if (!a || !a.token || syncing || !D.aiOn()) return;
    try {
      const r = await D.api('data/get', null, 'GET');
      if (!r.ok || !r.j.json) return;
      if (a.dirty) { await push(false); return; }
      if (r.j.updated > (a.base || 0)) {
        if (applyDoc(r.j.json)) { mark({ base: r.j.updated }); if (D.refresh && $('#sheet').hidden) D.refresh(); }
      }
    } catch (e) { /* нет сети */ }
  }

  // сервер: статус Pro и имя
  async function refreshMe() {
    const a = D.acc.get();
    if (!a || !a.token || !D.aiOn()) return;
    try {
      const r = await D.api('auth/me', {});
      if (r.ok && r.j.user) setPro(r.j.user);
    } catch (e) { /* нет сети */ }
  }

  function setPro(user) {
    const until = Number(user.pro_until) || 0;
    if (D.S.pro.until !== until) {
      applying = true;
      try { D.S.pro.until = until; D.save(); } finally { applying = false; }
      if (D.refresh && $('#sheet').hidden) D.refresh();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { const a = D.acc.get(); if (a && a.dirty) push(false); }
    else { pull(); refreshMe(); }
  });
  window.addEventListener('online', () => { push(false); pull(); });

  /* ---------- вход и регистрация ---------- */

  let authBox = null;

  function closeAuth(cb) {
    if (!authBox) return;
    const box = authBox; authBox = null;
    box.classList.remove('show');
    setTimeout(() => { box.remove(); document.body.classList.remove('lock'); if (cb) cb(); }, 600);
  }

  function hasLocalData() {
    const S = D.S;
    return !!(S.tasks.length || S.notes.length || S.meals.length || S.money.length || S.habits.length || S.lists.length);
  }

  function showAuth(done, note) {
    if (authBox) return;
    let mode = 'reg';
    const box = authBox = h('div', { class: 'onb auth', id: 'auth', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'вход в аккаунт' });
    document.body.append(box);
    document.body.classList.add('lock');

    const name = h('input', { class: 'field', placeholder: 'как тебя зовут', maxlength: '24', autocomplete: 'given-name', autocapitalize: 'words', 'aria-label': 'имя' });
    const login = h('input', { class: 'field', placeholder: 'логин', maxlength: '24', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'логин' });
    const pass = h('input', { class: 'field', placeholder: 'пароль', type: 'password', maxlength: '100', autocomplete: 'current-password', 'aria-label': 'пароль' });
    const err = h('p', { class: 'auth-err', role: 'alert' });
    const go = h('button', { class: 'btn solid block', type: 'button' });
    const tabs = h('div', { class: 'auth-tabs' });
    const hint = h('p', { class: 'cap' });

    const draw = () => {
      tabs.replaceChildren(
        h('button', { type: 'button', class: mode === 'reg' ? 'on' : '', text: 'создать аккаунт', onclick: () => { mode = 'reg'; draw(); } }),
        h('button', { type: 'button', class: mode === 'in' ? 'on' : '', text: 'войти', onclick: () => { mode = 'in'; draw(); } }));
      name.hidden = mode !== 'reg';
      pass.autocomplete = mode === 'reg' ? 'new-password' : 'current-password';
      go.textContent = mode === 'reg' ? 'создать аккаунт' : 'войти';
      hint.textContent = mode === 'reg'
        ? (hasLocalData() ? 'Данные с этого телефона перенесутся в аккаунт. Придумай логин и пароль от 6 символов.' : 'Логин: латиница, цифры, точка и подчёркивание. Пароль от 6 символов. Восстановить пароль нельзя, запомни его.')
        : 'Войди, и твои данные и Pro появятся на этом устройстве.';
      err.textContent = '';
    };

    const submit = async () => {
      const lg = login.value.trim().toLowerCase(), pw = pass.value;
      const nm = L.cleanName(name.value);
      if (mode === 'reg' && !nm) { err.textContent = 'введи имя'; name.focus(); return; }
      if (!/^[a-z0-9_.]{3,24}$/.test(lg)) { err.textContent = 'логин: 3–24 символа, латиница, цифры, точка и подчёркивание'; login.focus(); return; }
      if (pw.length < 6) { err.textContent = 'пароль: от 6 символов'; pass.focus(); return; }
      go.disabled = true; err.textContent = '';
      const was = go.textContent; go.textContent = '…';
      try {
        const r = await D.api(mode === 'reg' ? 'auth/register' : 'auth/login', { login: lg, password: pw, name: nm }, 'POST');
        if (!r.ok) { err.textContent = r.j.detail || 'не получилось, попробуй ещё раз'; return; }
        D.acc.set({ token: r.j.token, login: r.j.user.login, base: 0, dirty: false });
        setPro(r.j.user);
        if (mode === 'reg') {
          if (nm) D.S.name = nm;
          applying = true; try { D.save(); } finally { applying = false; }
          mark({ dirty: true });
          await push(true);
        } else if (r.j.hasData) {
          const g = await D.api('data/get', null, 'GET');
          if (g.ok && g.j.json) { applyDoc(g.j.json); mark({ base: g.j.updated, dirty: false }); }
        } else {
          mark({ dirty: true }); await push(true);
        }
        if (!D.S.name && r.j.user.name) { D.S.name = r.j.user.name; applying = true; try { D.save(); } finally { applying = false; } }
        D.render(true);
        closeAuth(done);
      } catch (e) {
        err.textContent = 'нет связи с сервером. проверь интернет';
      } finally { go.disabled = false; if (authBox) go.textContent = was; }
    };
    [name, login, pass].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }));
    go.addEventListener('click', submit);

    box.append(
      h('div', { class: 'onb-top' }, h('div', { class: 'onb-brand' }, D.logo('logo'), h('span', { text: 'DDX PLANNER' }))),
      h('div', { class: 'onb-body auth-body' },
        h('div', { class: 'onb-no', 'aria-hidden': 'true', text: '@' }),
        h('h2', { text: note || 'Войди в аккаунт' }),
        tabs,
        h('div', { class: 'form', style: 'margin-top:14px' }, name, login, eye(pass), err, hint)),
      h('div', { class: 'onb-foot' }, go));
    draw();
    requestAnimationFrame(() => box.classList.add('show'));
  }

  // вызывается после знакомства: без аккаунта дальше не пускаем
  D.requireAuth = (done) => {
    if (!D.C.accounts || !D.aiOn()) { done(); return; }
    const a = D.acc.get();
    if (a && a.token) { done(); pull(); refreshMe(); return; }
    // воркер без базы D1 или старой версии: входить некуда, пускаем без аккаунта, чтобы приложение не стало кирпичом
    D.api('auth/me', {}).then((r) => { if (r.status === 401) showAuth(done); else done(); }).catch(() => showAuth(done));
  };

  // сервер сказал, что токен недействителен (вышли на другом устройстве, сменили пароль)
  D.onAuthLost = () => {
    if (authBox) return;
    D.acc.clear();
    showAuth(() => { if (!D.S.name && D.askName) D.askName(); }, 'Войди снова');
  };

  /* ---------- карточка аккаунта в настройках ---------- */

  // поле пароля с кнопкой «показать»
  function eye(input) {
    const btn = h('button', { class: 'pw-eye', type: 'button', 'aria-label': 'показать пароль', 'aria-pressed': 'false' }, D.icon('eye'));
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.replaceChildren(D.icon(show ? 'eyeoff' : 'eye'));
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'скрыть пароль' : 'показать пароль');
      input.focus();
    });
    const box = h('div', { class: 'pw-box' }, input, btn);
    Object.defineProperty(box, 'value', { get: () => input.value });
    box.focus = () => input.focus();
    return box;
  }

  function sheetForm(title, text, fields, yes, run) {
    D.openSheet((panel) => {
      const err = h('p', { class: 'auth-err', role: 'alert' });
      const btn = h('button', { class: 'btn solid block', type: 'button', text: yes });
      btn.addEventListener('click', async () => {
        btn.disabled = true; err.textContent = '';
        try { const msg = await run(fields.map((f) => f.value)); if (msg) err.textContent = msg; }
        catch (e) { err.textContent = 'нет связи с сервером'; }
        finally { btn.disabled = false; }
      });
      panel.append(label('аккаунт'), h('h2', { style: 'margin-top:6px', text: title }), text ? h('p', { class: 'cap', text: text }) : null,
        h('div', { class: 'form', style: 'margin-top:14px' }, fields, err, btn,
          h('button', { class: 'btn block', type: 'button', text: 'отмена', onclick: D.closeSheet })));
    });
  }

  async function logout() {
    const a = D.acc.get();
    try { if (a && a.dirty) await push(false); await D.api('auth/logout', {}); } catch (e) { /* выходим в любом случае */ }
    wipeLocal();
    showAuth(() => { if (!D.S.name && D.askName) D.askName(); }, 'Войди в аккаунт');
  }

  // на устройстве после выхода ничего не остаётся: данные лежат в облаке
  function wipeLocal() {
    D.acc.clear();
    applying = true;
    try { D.S = D.blank(); D.save(); } finally { applying = false; }
    D.render(true);
  }

  D.accountCard = () => {
    const a = D.acc.get();
    if (!a || !a.token) return null;
    const when = a.at ? new Date(a.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    const pwOld = h('input', { class: 'field', type: 'password', placeholder: 'текущий пароль', autocomplete: 'current-password', 'aria-label': 'текущий пароль' });
    const pwNew = h('input', { class: 'field', type: 'password', placeholder: 'новый пароль, от 6 символов', autocomplete: 'new-password', 'aria-label': 'новый пароль' });
    const delPw = h('input', { class: 'field', type: 'password', placeholder: 'пароль', autocomplete: 'current-password', 'aria-label': 'пароль' });
    return D.card('', label('аккаунт'),
      h('div', { style: 'margin-top:8px' },
        h('div', { class: 'kv' }, h('span', { text: 'логин' }), h('span', { class: 'muted', text: a.login })),
        h('div', { class: 'kv' }, h('span', { text: 'облако' }), h('span', { class: 'muted', text: a.dirty ? 'сохраняется…' : when ? 'сохранено в ' + when : 'сохранено' }))),
      h('div', { class: 'form', style: 'margin-top:12px' },
        h('button', { class: 'btn block', type: 'button', text: 'сменить пароль', onclick: () => sheetForm('сменить пароль', 'Сначала введи текущий пароль, потом новый.', [eye(pwOld), eye(pwNew)], 'сменить', async (v) => {
          if (v[1].length < 6) return 'новый пароль: от 6 символов';
          const r = await D.api('auth/password', { password: v[0], newPassword: v[1] });
          if (!r.ok) return r.j.detail || 'не получилось';
          D.closeSheet(); toast('пароль изменён, на других устройствах войди заново');
        }) }),
        h('button', { class: 'btn block', type: 'button', text: 'выйти из аккаунта', onclick: () => D.ask('выйти из аккаунта?', 'Данные сохранены в облаке и вернутся после входа. С этого телефона они сотрутся.', 'выйти', logout) }),
        h('button', { class: 'btn block', type: 'button', text: 'удалить аккаунт', onclick: () => sheetForm('удалить аккаунт?', 'Аккаунт, облачные данные и Pro удалятся без возможности восстановления. Введи пароль.', [eye(delPw)], 'удалить навсегда', async (v) => {
          const r = await D.api('auth/delete', { password: v[0] });
          if (!r.ok) return r.j.detail || 'не получилось';
          D.closeSheet(); wipeLocal(); showAuth(null, 'Создай аккаунт');
        }) })));
  };

  // активация кода на сервере: возвращает текст ошибки или '' при успехе
  D.activateCode = async (code) => {
    const r = await D.api('pro/activate', { code: code });
    if (!r.ok) return r.j.detail || 'не получилось, попробуй ещё раз';
    setPro({ pro_until: r.j.pro_until });
    return '';
  };
})();
