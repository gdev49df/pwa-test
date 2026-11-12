/* ядро ddx planner: данные, окна, лимиты, маршруты, напоминания.
   страницы лежат в hubs.js и extra.js, быстрый ввод в capture.js */
(function () {
  'use strict';

  const L = window.DDXLib;
  const C = window.DDX_CONFIG;
  const KEY = 'ddx-v2';
  const OLD_KEY = 'ddx-v1';

  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const PRI_LABEL = ['обычная', 'важная', 'срочная'];

  /* ---------- мелочи ---------- */

  const $ = (s) => document.querySelector(s);
  const pad = L.pad;
  const today = () => L.dkey(new Date());
  const tomorrow = () => L.dkey(L.addDays(new Date(), 1));
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plural = L.plural;
  const hm = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  function h(tag, attrs) {
    const e = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'value') e.value = v;
        else if (k === 'checked') e.checked = !!v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    (function add(list) {
      list.forEach((c) => {
        if (Array.isArray(c)) add(c);
        else if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    if (attrs && attrs.value != null) e.value = attrs.value; // select: после добавления options
    return e;
  }

  const ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="3"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 3v18M3 12h18"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M14 6l-6 6 6 6"/>',
    right: '<path d="M10 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'
  };
  function icon(name) {
    const s = document.createElement('span');
    s.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return s.firstChild;
  }

  function card(cls) {
    return h.apply(null, ['div', { class: 'card ' + (cls || '') }].concat(Array.prototype.slice.call(arguments, 1)));
  }
  // карточка, по которой можно нажать: кнопка для экранного диктора и клавиатуры
  function tapCard(cls, onclick) {
    const kids = Array.prototype.slice.call(arguments, 2);
    const c = card.apply(null, ['tap ' + (cls || '')].concat(kids));
    c.setAttribute('role', 'button');
    c.tabIndex = 0;
    c.addEventListener('click', onclick);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick(e); } });
    return c;
  }
  const label = (t, cls) => h('p', { class: 'label ' + (cls || ''), text: t });
  const empty = (title, hint) => card('empty', h('p', { class: 'empty-title', text: title }), h('p', { text: hint }));
  const section = (t, right) => h('div', { class: 'section' }, label(t), right || null);

  function chips(items, cur, onpick, cls) {
    const box = h('div', { class: 'chips ' + (cls || '') });
    items.forEach((it) => {
      box.append(h('button', {
        class: 'chip' + (it[0] === cur ? ' on' : ''), type: 'button', text: it[1], 'aria-pressed': it[0] === cur ? 'true' : 'false',
        onclick: () => {
          box.querySelectorAll('.chip').forEach((c, j) => { const on = items[j][0] === it[0]; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          onpick(it[0]);
        }
      }));
    });
    return box;
  }

  function dateLabel(key) {
    if (!key) return '';
    if (key === today()) return 'сегодня';
    if (key === tomorrow()) return 'завтра';
    if (key === L.dkey(L.addDays(new Date(), -1))) return 'вчера';
    const d = L.fromKey(key);
    const s = d.getDate() + ' ' + MON_SHORT[d.getMonth()];
    return d.getFullYear() !== new Date().getFullYear() ? s + ' ' + d.getFullYear() : s;
  }
  function dueLabel(key, time) {
    if (!key) return '';
    let s = dateLabel(key);
    if (key < today()) s = 'просрочено, ' + s;
    return time ? s + ', ' + time : s;
  }
  function stampOf(ts) { return dateLabel(L.dkey(new Date(ts))) + ', ' + hm(ts); }
  function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400 && L.dkey(new Date(ts)) === today()) return 'в ' + hm(ts);
    return stampOf(ts);
  }

  /* ---------- данные ---------- */

  const blank = () => ({
    v: 2, name: '', tasks: [], notes: [], cats: [], lists: [], habits: [], meals: [], water: {}, money: [],
    goals: { water: 2500, kcal: 2000 }, budget: 0,
    focus: { active: null, log: [] },
    pro: { until: 0, used: [] }, usage: {}, settings: { resetHour: 18 }, last: null
  });

  function migrate(old) {
    const s = blank();
    s.name = old.name || '';
    s.cats = old.cats || [];
    s.tasks = (old.tasks || []).map((t) => Object.assign({ kind: 'task', remind: false, subs: [] }, t, { repeat: L.normRule(t.repeat) }));
    s.notes = old.notes || [];
    s.meals = old.meals || [];
    s.money = (old.money || []).map((m) => Object.assign({ cat: m.kind === 'inc' ? 'доход' : L.moneyCat(m.text) }, m));
    s.pro = Object.assign({ until: 0, used: [] }, old.pro);
    return s;
  }

  function load() {
    try {
      let r = JSON.parse(localStorage.getItem(KEY));
      if (!r) {
        const old = JSON.parse(localStorage.getItem(OLD_KEY));
        if (old && typeof old === 'object') r = migrate(old);
      }
      const b = blank();
      if (r && typeof r === 'object') {
        Object.keys(b).forEach((k) => { if (r[k] != null) b[k] = r[k]; });
        b.pro = Object.assign({ until: 0, used: [] }, b.pro);
        b.goals = Object.assign(blank().goals, b.goals);
        b.settings = Object.assign(blank().settings, b.settings);
        b.focus = Object.assign({ active: null, log: [] }, b.focus);
        b.tasks.forEach((t) => { t.repeat = L.normRule(t.repeat); if (!t.subs) t.subs = []; if (!t.kind) t.kind = 'task'; });
      }
      return b;
    } catch (e) { return blank(); }
  }

  // Element.append печатает null как текст «null»; в приложении null значит «ничего не добавлять»
  const nativeAppend = Element.prototype.append;
  Element.prototype.append = function () {
    return nativeAppend.apply(this, Array.prototype.filter.call(arguments, (x) => x != null && x !== false));
  };

  const D = window.DDX = { L: L, C: C };
  D.S = load();
  let saveFail = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D.S)); saveFail = false; }
    catch (e) {
      // чаще всего кончилось место из-за фото еды: убираем самые старые фото и пробуем ещё раз
      const withPhoto = D.S.meals.filter((m) => m.photo);
      if (withPhoto.length) { withPhoto.slice(-Math.ceil(withPhoto.length / 2)).forEach((m) => { delete m.photo; }); try { localStorage.setItem(KEY, JSON.stringify(D.S)); return; } catch (e2) { /* ниже */ } }
      if (!saveFail) { saveFail = true; toast('не удалось сохранить: память браузера заполнена'); }
    }
  }

  const isPro = () => D.S.pro.until > Date.now();
  const lim = (k) => (isPro() ? Infinity : C.limits[k]);

  function usage() {
    const t = today();
    if (!D.S.usage[t]) D.S.usage = { [t]: { voice: 0, voiceCat: 0, focus: 0 } };
    const u = D.S.usage[t];
    if (u.focus == null) u.focus = 0;
    return u;
  }

  /* ---------- окна, подсказки ---------- */

  let sheetTimer = null, sheetLocked = false, sheetOnClose = null;
  function openSheet(build, opts) {
    opts = opts || {};
    const sheet = $('#sheet'), panel = $('#sheet-panel');
    clearTimeout(sheetTimer);
    sheetLocked = !!opts.locked;
    sheetOnClose = opts.onclose || null;
    panel.replaceChildren();
    build(panel);
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => sheet.classList.add('show'));
  }
  function closeSheet() {
    const sheet = $('#sheet');
    if (sheet.hidden) return;
    sheetLocked = false;
    sheet.classList.remove('show');
    document.body.style.overflow = '';
    document.body.classList.remove('typing');
    clearTimeout(sheetTimer);
    const cb = sheetOnClose; sheetOnClose = null;
    sheetTimer = setTimeout(() => { sheet.hidden = true; $('#sheet-panel').replaceChildren(); }, 300);
    if (cb) cb();
  }
  $('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet') && !sheetLocked) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden && !sheetLocked) closeSheet(); });
  // клавиатура на iphone закрывает панель снизу, чтобы не прыгали кнопки
  document.addEventListener('focusin', (e) => { if (e.target.matches('input:not([type=checkbox]), textarea')) document.body.classList.add('typing'); });
  document.addEventListener('focusout', () => setTimeout(() => {
    const a = document.activeElement;
    if (!a || !a.matches('input:not([type=checkbox]), textarea')) document.body.classList.remove('typing');
  }, 60));

  // подтверждение в своём стиле вместо системного confirm
  function ask(title, text, yes, onyes) {
    openSheet((p) => p.append(
      h('h2', { text: title }), text ? h('p', { class: 'cap', text: text }) : null,
      h('div', { class: 'form' },
        h('button', { class: 'btn solid block', type: 'button', text: yes, onclick: () => { closeSheet(); onyes(); } }),
        h('button', { class: 'btn block', type: 'button', text: 'отмена', onclick: closeSheet }))
    ));
  }

  let toastTimer = null;
  function toast(msg, undo) {
    const t = $('#toast');
    t.replaceChildren(h('span', { text: msg }));
    if (undo) t.append(h('button', { type: 'button', text: 'отменить', onclick: () => { t.hidden = true; undo(); } }));
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 4200 : 2400);
  }

  const LIMIT_NAMES = {
    notes: 'текстовых заметок', tasks: 'активных задач', cats: 'своих категорий', subs: 'подзадач на одну задачу',
    repeats: 'повторяющихся задач', pins: 'закреплённых заметок', moneyMonth: 'записей доходов и расходов в месяц',
    voiceDay: 'голосовых записей в день', voiceCatDay: 'голосовых выборов категории в день', reminders: 'активных напоминаний',
    focusDay: 'сессий Focus Mode в день', lists: 'умных списков', habits: 'привычек', statsDays: 'дней статистики'
  };
  // возвращает false, чтобы можно было написать: if (над лимитом) return limitHit(...)
  function limitHit(kind) {
    const n = C.limits[kind];
    openSheet((panel) => panel.append(
      label('бесплатный тариф'),
      h('h2', { style: 'margin-top:6px', text: 'лимит: ' + n + ' ' + (LIMIT_NAMES[kind] || '') }),
      h('p', { class: 'cap', text: 'Pro снимает все ограничения за ' + fmt(C.price.month) + ' ₸ в месяц.' }),
      h('div', { class: 'form' },
        h('button', { class: 'btn solid block', type: 'button', text: 'смотреть тарифы', onclick: () => { closeSheet(); go('subscriptions'); } }),
        h('button', { class: 'btn block', type: 'button', text: 'позже', onclick: closeSheet }))
    ));
    return false;
  }
  function limitLine(text, n, key) {
    return isPro() ? null : label(text + ': ' + n + ' из ' + C.limits[key], 'tiny');
  }

  /* ---------- действия с данными ---------- */

  const activeTasks = () => D.S.tasks.filter((t) => !t.done);
  const activeReminders = () => D.S.tasks.filter((t) => !t.done && t.remind);
  function setLast(type, text) { D.S.last = { type: type, text: text, t: Date.now() }; }

  function addTask(o) {
    if (activeTasks().length >= lim('tasks')) return limitHit('tasks');
    if (o.repeat && activeTasks().filter((t) => t.repeat).length >= lim('repeats')) return limitHit('repeats');
    if (o.remind && activeReminders().length >= lim('reminders')) return limitHit('reminders');
    const rule = L.normRule(o.repeat);
    const t = {
      id: uid(), title: o.title, kind: o.kind || 'task', pri: o.pri || 0,
      due: o.due || (rule ? L.firstDue(rule, today()) : null), time: o.time || null, repeat: rule,
      remind: !!(o.remind && (o.time || o.due)), place: o.place || '', subs: (o.subs || []).map((s) => ({ t: s, done: false })),
      done: false, created: Date.now()
    };
    if (t.remind && !t.time) t.time = '09:00';
    D.S.tasks.unshift(t);
    setLast(t.kind === 'meeting' ? 'встреча' : 'задача', t.title);
    save();
    return t;
  }

  function toggleTask(t) {
    if (!t.done) {
      t.done = true; t.doneAt = Date.now(); t.doneKey = today();
      if (t.repeat) {
        D.S.tasks.unshift(Object.assign({}, t, {
          id: uid(), done: false, doneAt: null, doneKey: null, created: Date.now(), fired: false,
          due: L.nextDue(t.due || today(), t.repeat), subs: t.subs.map((s) => ({ t: s.t, done: false }))
        }));
        t.repeatSpawned = true;
      }
    } else {
      t.done = false; t.doneAt = null; t.doneKey = null;
      // если по повтору уже создали следующую, убираем её, чтобы не было двойников
      if (t.repeatSpawned) {
        const i = D.S.tasks.findIndex((x) => x !== t && !x.done && x.title === t.title && x.repeat && x.created > (t.created || 0));
        if (i >= 0) D.S.tasks.splice(i, 1);
        t.repeatSpawned = false;
      }
    }
    save();
  }

  function addNote(text, cat) {
    if (D.S.notes.filter((n) => !n.archived).length >= lim('notes')) return limitHit('notes');
    const n = { id: uid(), text: text, cat: cat || '', pin: false, t: Date.now() };
    D.S.notes.unshift(n);
    setLast('заметка', text);
    save();
    return n;
  }

  function addCat(name) {
    name = L.cap(String(name || '').replace(/\s+/g, ' '));
    if (!name) return '';
    const ex = D.S.cats.find((c) => c.toLowerCase() === name.toLowerCase());
    if (ex) return ex;
    if (D.S.cats.length >= lim('cats')) { limitHit('cats'); return ''; }
    D.S.cats.push(name);
    save();
    return name;
  }

  const monthOf = (ts) => L.monthKey(new Date(ts));
  const monthMoney = (mk) => D.S.money.filter((m) => monthOf(m.t) === (mk || L.monthKey(new Date())));

  function addMoney(kind, amount, text, cat) {
    if (monthMoney().length >= lim('moneyMonth')) return limitHit('moneyMonth');
    const m = { id: uid(), kind: kind, amount: amount, text: text || '', cat: cat || (kind === 'inc' ? 'доход' : L.moneyCat(text)), t: Date.now() };
    D.S.money.unshift(m);
    setLast(kind === 'exp' ? 'расход' : 'доход', (text || '') + ' ' + fmt(amount) + ' ₸');
    save();
    return m;
  }

  function addMeal(text, kcal, photo) {
    const m = { id: uid(), text: text, kcal: Math.max(0, Math.round(kcal || 0)), t: Date.now() };
    if (photo) m.photo = photo;
    D.S.meals.unshift(m);
    setLast('еда', text + (m.kcal ? ', ' + m.kcal + ' ккал' : ''));
    save();
    return m;
  }

  function addWater(ml) {
    const k = today();
    D.S.water[k] = Math.max(0, (D.S.water[k] || 0) + ml);
    if (ml > 0) setLast('вода', '+' + ml + ' мл');
    save();
  }

  const LIST_NAMES = { shop: 'Покупки', wish: 'Желания', books: 'Книги', movies: 'Фильмы', check: 'Чек-лист' };
  function listFor(kindOrId, create) {
    let l = D.S.lists.find((x) => x.id === kindOrId) || D.S.lists.find((x) => x.kind === kindOrId);
    if (!l && create && LIST_NAMES[kindOrId]) {
      if (D.S.lists.length >= lim('lists')) { limitHit('lists'); return null; }
      l = { id: uid(), kind: kindOrId, name: LIST_NAMES[kindOrId], items: [], created: Date.now() };
      D.S.lists.push(l);
    }
    return l || null;
  }
  function addListItems(list, items) {
    items.forEach((t) => { if (t) list.items.unshift({ id: uid(), t: t, done: false, created: Date.now() }); });
    setLast(list.name.toLowerCase(), items.join(', '));
    save();
  }

  function addHabit(name) {
    if (D.S.habits.length >= lim('habits')) return limitHit('habits');
    const x = { id: uid(), name: name, days: {}, created: Date.now() };
    D.S.habits.push(x);
    save();
    return x;
  }
  function markHabit(x, key, on) {
    if (on) x.days[key] = 1; else delete x.days[key];
    save();
  }

  /* ---------- напоминания ----------
     пока приложение открыто: баннер, вибрация и системное уведомление (если разрешено).
     чтобы напоминание сработало при закрытом приложении, у задачи есть кнопка «в календарь iphone» (.ics) */

  function dueTs(t) {
    if (!t.due) return 0;
    const d = L.fromKey(t.due);
    const p = (t.time || '09:00').split(':').map(Number);
    d.setHours(p[0], p[1], 0, 0);
    return d.getTime();
  }

  function notify(title, body, tag) {
    try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* нет вибрации */ }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body: body, tag: tag || 'ddx', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { /* нет */ } });
    } else { try { new Notification(title, opts); } catch (e) { /* нет */ } }
  }

  function showAlarm(t) {
    const box = $('#alarm');
    box.replaceChildren(card('paper',
      label(t.kind === 'meeting' ? 'встреча' : 'напоминание'),
      h('p', { class: 'lead', text: t.title }),
      h('p', { class: 'cap', text: dueLabel(t.due, t.time) + (t.place ? ', ' + t.place : '') }),
      h('div', { class: 'line', style: 'margin-top:12px' },
        h('button', { class: 'btn sm', style: 'flex:1;background:#111112;color:#fff;border-color:#111112', type: 'button', text: 'готово', onclick: () => { toggleTask(t); box.hidden = true; render(false); } }),
        h('button', { class: 'btn sm', style: 'flex:1;background:transparent;color:#111112;border-color:rgba(0,0,0,.2)', type: 'button', text: '+10 мин', onclick: () => {
          const n = new Date(Date.now() + 600000); t.due = L.dkey(n); t.time = pad(n.getHours()) + ':' + pad(n.getMinutes()); t.fired = false; save(); box.hidden = true; toast('напомню в ' + t.time); render(false);
        } }),
        h('button', { class: 'btn sm', style: 'background:transparent;color:#111112;border-color:rgba(0,0,0,.2)', type: 'button', 'aria-label': 'закрыть', onclick: () => { box.hidden = true; } }, icon('close'))
      )
    ));
    box.hidden = false;
  }

  function checkReminders() {
    const now = Date.now();
    D.S.tasks.forEach((t) => {
      if (t.done || !t.remind || t.fired || !t.due) return;
      const ts = dueTs(t);
      if (ts <= now && now - ts < 12 * 3600000) {
        t.fired = true;
        save();
        showAlarm(t);
        notify(t.kind === 'meeting' ? 'Встреча' : 'Напоминание', t.title + (t.place ? ' · ' + t.place : ''), t.id);
      }
    });
    tickFocus();
  }

  function downloadIcs(t) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const blob = new Blob([L.ics(t, stamp)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'ddx-' + (t.title || 'event').replace(/[^\p{L}\d]+/gu, '-').slice(0, 30) + '.ics' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('открой файл и нажми «добавить в календарь»');
  }

  /* ---------- focus mode: таймер живёт по отметке времени, переживает перезагрузку ---------- */

  function focusLeft() {
    const f = D.S.focus.active;
    if (!f) return 0;
    if (f.paused != null) return f.paused;
    return Math.max(0, f.end - Date.now());
  }
  function startFocus(min, taskId) {
    if (!isPro() && usage().focus >= C.limits.focusDay) return limitHit('focusDay');
    usage().focus++;
    D.S.focus.active = { min: min, taskId: taskId || null, start: Date.now(), end: Date.now() + min * 60000, paused: null };
    save();
    return true;
  }
  function finishFocus(completed) {
    const f = D.S.focus.active;
    if (!f) return;
    const spent = Math.round((f.min * 60000 - focusLeft()) / 60000);
    if (spent > 0) D.S.focus.log.unshift({ t: Date.now(), min: completed ? f.min : spent, taskId: f.taskId, full: !!completed });
    D.S.focus.log = D.S.focus.log.slice(0, 500);
    D.S.focus.active = null;
    save();
  }
  function tickFocus() {
    const f = D.S.focus.active;
    if (f && f.paused == null && f.end <= Date.now()) {
      const t = D.S.tasks.find((x) => x.id === f.taskId);
      finishFocus(true);
      notify('Фокус завершён', (t ? t.title + ' · ' : '') + f.min + ' минут', 'focus');
      toast('фокус завершён: ' + f.min + ' минут');
      render(false);
    }
  }

  /* ---------- маршруты, шапка, панель ---------- */

  const PAGES = {};
  const HUBS = ['digest', 'tasks', 'notes', 'food', 'money'];
  const TAB_LABEL = { digest: 'Главная', tasks: 'Задачи', notes: 'Заметки', food: 'Еда', money: 'Деньги' };
  function page(name, title, build, parent) { PAGES[name] = { title: title, build: build, parent: parent || 'menu' }; }

  let route = 'digest', param = '';
  function currentRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const r = parts[0] || 'digest';
    param = decodeURIComponent(parts.slice(1).join('/') || '');
    return PAGES[r] ? r : 'digest';
  }
  function go(r, p) {
    const target = '#/' + r + (p ? '/' + encodeURIComponent(p) : '');
    if (location.hash === target) render(true); else location.hash = target;
  }
  window.addEventListener('hashchange', () => render(true));

  function buildTabs() {
    const nav = $('#tabs');
    HUBS.forEach((r, i) => {
      nav.append(h('button', { class: 'tab', type: 'button', 'data-r': r, 'aria-label': TAB_LABEL[r], onclick: () => go(r) },
        h('span', { class: 'no', text: pad(i + 1) }), h('span', { class: 'nm', text: TAB_LABEL[r] })));
    });
  }
  function updateTabs() {
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.r === route || (!HUBS.includes(route) && b.dataset.r === hubOf(route));
      b.classList.toggle('on', on);
      if (b.dataset.r === route) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function hubOf(r) {
    let x = r, guard = 0;
    while (x && !HUBS.includes(x) && guard++ < 6) x = PAGES[x] ? PAGES[x].parent : null;
    return x || 'digest';
  }

  function render(animate) {
    route = currentRoute();
    const pg = PAGES[route];
    const bar = $('#bar');
    bar.classList.toggle('hidden-bar', route === 'digest');
    if (route !== 'digest') {
      $('#kicker').textContent = HUBS.includes(route) ? pad(HUBS.indexOf(route) + 1) + ' · ddx planner' : 'ddx planner';
      $('#title').textContent = typeof pg.title === 'function' ? pg.title(param) : pg.title;
      const btn = $('#bar-btn');
      const isHub = HUBS.includes(route);
      btn.replaceChildren(icon(isHub ? 'menu' : 'back'));
      btn.setAttribute('aria-label', isHub ? 'меню' : 'назад');
      btn.onclick = () => go(isHub ? 'menu' : pg.parent);
    }
    const node = pg.build(param);
    if (animate) {
      node.classList.add('enter');
      Array.prototype.forEach.call(node.children, (c, i) => c.style.setProperty('--i', Math.min(i, 12)));
      window.scrollTo(0, 0);
    }
    $('#view').replaceChildren(node);
    updateTabs();
  }

  // перерисовать, сохранив прокрутку (после отметки задачи и т. п.)
  function refresh() { const y = window.scrollY; render(false); window.scrollTo(0, y); }

  Object.assign(D, {
    MONTHS, MONTHS_NOM, MON_SHORT, WEEKDAYS, PRI_LABEL, LIST_NAMES, HUBS,
    $, h, icon, card, tapCard, label, empty, section, chips, pad, today, tomorrow, fmt, uid, plural, hm,
    dateLabel, dueLabel, stampOf, ago, save, isPro, lim, usage, openSheet, closeSheet, ask, toast, limitHit, limitLine,
    activeTasks, activeReminders, addTask, toggleTask, addNote, addCat, monthMoney, addMoney, addMeal, addWater,
    listFor, addListItems, addHabit, markHabit, setLast, dueTs, notify, checkReminders, downloadIcs,
    focusLeft, startFocus, finishFocus, tickFocus, page, go, render, refresh, buildTabs, updateTabs, blank
  });
  // Object.assign копирует значение, а не геттер, поэтому маршрут отдаём отдельно
  Object.defineProperty(D, 'route', { get: () => route });
})();
