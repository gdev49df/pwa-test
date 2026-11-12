(function () {
  'use strict';

  const L = window.DDXLib;
  const C = window.DDX_CONFIG;
  const KEY = 'ddx-v1';

  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const WEEKDAYS_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const REPEAT = [null, 'daily', 'weekly', 'monthly'];
  const REPEAT_LABEL = { daily: 'каждый день', weekly: 'каждую неделю', monthly: 'каждый месяц' };
  const PRI_LABEL = ['обычная', 'важная', 'срочная'];

  /* ---------- мелочи ---------- */

  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => L.dkey(new Date());
  const tomorrow = () => L.dkey(L.addDays(new Date(), 1));
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function plural(n, one, few, many) {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

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
    digest: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
    tasks: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
    food: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3"/>',
    money: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 9h7M12 9v7M9.5 12.5h5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="3"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>'
  };
  function icon(name) {
    const s = document.createElement('span');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return s.firstChild;
  }

  /* ---------- данные ---------- */

  const blank = () => ({ v: 1, name: '', tasks: [], notes: [], meals: [], money: [], cats: [], pro: { until: 0, used: [] }, usage: {} });
  let S = load();

  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY));
      const b = blank();
      if (r && typeof r === 'object') {
        Object.keys(b).forEach((k) => { if (r[k] != null) b[k] = r[k]; });
        b.pro = Object.assign({ until: 0, used: [] }, b.pro);
      }
      return b;
    } catch (e) { return blank(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } }

  const isPro = () => S.pro.until > Date.now();
  const lim = (k) => (isPro() ? Infinity : C.limits[k]);

  function usage() {
    const t = today();
    if (!S.usage[t]) S.usage = { [t]: { voice: 0, voiceCat: 0 } };
    return S.usage[t];
  }

  /* ---------- окна, подсказки ---------- */

  let sheetTimer = null, sheetLocked = false; // locked: окно нельзя закрыть, пока не заполнено (имя при первом запуске)
  function openSheet(build, locked) {
    const sheet = $('#sheet'), panel = $('#sheet-panel');
    clearTimeout(sheetTimer);
    sheetLocked = !!locked;
    panel.replaceChildren();
    build(panel);
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('show'));
  }
  function closeSheet() {
    const sheet = $('#sheet');
    sheetLocked = false;
    sheet.classList.remove('show');
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(() => { sheet.hidden = true; $('#sheet-panel').replaceChildren(); }, 300);
  }
  $('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet') && !sheetLocked) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden && !sheetLocked) closeSheet(); });

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  const LIMIT_NAMES = {
    notes: 'текстовых заметок', tasks: 'активных задач', cats: 'своих категорий', subs: 'подзадач на одну задачу',
    repeats: 'повторяющихся задач', pins: 'закреплённых заметок', moneyMonth: 'записей доходов и расходов в месяц',
    voiceDay: 'голосовых записей в день', voiceCat: 'голосовых выборов категории в день'
  };
  // возвращает false, чтобы можно было написать: if (над лимитом) return limitHit(...)
  function limitHit(kind) {
    const n = C.limits[kind === 'voiceCat' ? 'voiceCatDay' : kind];
    openSheet((panel) => {
      panel.append(
        h('h2', { text: 'лимит тарифа' }),
        h('p', { class: 'cap', text: 'В бесплатном тарифе до ' + n + ' ' + LIMIT_NAMES[kind] + '. Pro снимает все ограничения.' }),
        h('div', { class: 'form' },
          h('button', { class: 'btn solid block', type: 'button', text: 'смотреть тарифы', onclick: () => { closeSheet(); go('subscriptions'); } }),
          h('button', { class: 'btn block', type: 'button', text: 'позже', onclick: closeSheet })
        )
      );
    });
    return false;
  }

  /* ---------- действия с данными ---------- */

  const activeTasks = () => S.tasks.filter((t) => !t.done);

  function addTask(o) {
    if (activeTasks().length >= lim('tasks')) return limitHit('tasks');
    if (o.repeat && activeTasks().filter((t) => t.repeat).length >= lim('repeats')) return limitHit('repeats');
    S.tasks.unshift({
      id: uid(), title: o.title, pri: o.pri || 0, due: o.due || (o.repeat ? today() : null), time: o.time || null, repeat: o.repeat || null,
      done: false, subs: [], created: Date.now()
    });
    save();
    return true;
  }

  function toggleTask(t) {
    if (!t.done) {
      t.done = true; t.doneAt = Date.now(); t.doneKey = today();
      if (t.repeat) {
        S.tasks.unshift(Object.assign({}, t, {
          id: uid(), done: false, doneAt: null, doneKey: null, created: Date.now(),
          due: L.nextDue(t.due || today(), t.repeat), subs: t.subs.map((s) => ({ t: s.t, done: false }))
        }));
      }
    } else { t.done = false; t.doneAt = null; t.doneKey = null; }
    save();
  }

  function addNote(text, cat) {
    if (S.notes.filter((n) => !n.archived).length >= lim('notes')) return limitHit('notes');
    S.notes.unshift({ id: uid(), text: text, cat: cat || '', pin: false, t: Date.now() });
    save();
    return true;
  }

  function addCat(name) {
    name = L.cap(name.replace(/\s+/g, ' '));
    if (!name || S.cats.some((c) => c.toLowerCase() === name.toLowerCase())) return name;
    if (S.cats.length >= lim('cats')) { limitHit('cats'); return ''; }
    S.cats.push(name);
    save();
    return name;
  }

  const monthMoney = () => S.money.filter((m) => L.monthKey(new Date(m.t)) === L.monthKey(new Date()));

  function addMoney(kind, amount, text) {
    if (monthMoney().length >= lim('moneyMonth')) return limitHit('moneyMonth');
    S.money.unshift({ id: uid(), kind: kind, amount: amount, text: text || '', t: Date.now() });
    save();
    return true;
  }

  /* ---------- отображение ---------- */

  const MIN_BY = (a, b) => (b.pri - a.pri) || String(a.due || '9').localeCompare(String(b.due || '9')) || (b.created - a.created);

  function dueLabel(key, time) {
    if (!key) return '';
    let s;
    if (key === today()) s = 'сегодня';
    else if (key === tomorrow()) s = 'завтра';
    else {
      const d = L.fromKey(key);
      s = d.getDate() + ' ' + MON_SHORT[d.getMonth()];
      if (key < today()) s = 'просрочено, ' + s;
    }
    return time ? s + ', ' + time : s;
  }

  function stampOf(ts) {
    const d = new Date(ts), n = new Date();
    const tm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (L.dkey(d) === L.dkey(n)) return 'сегодня, ' + tm;
    if (L.dkey(d) === L.dkey(L.addDays(n, -1))) return 'вчера, ' + tm;
    return d.getDate() + ' ' + MON_SHORT[d.getMonth()] + ', ' + tm;
  }

  function card(cls) {
    return h.apply(null, ['div', { class: 'card ' + (cls || '') }].concat(Array.prototype.slice.call(arguments, 1)));
  }
  const kick = (t, cls) => h('p', { class: 'kicker ' + (cls || ''), text: t });
  const empty = (title, hint) => h('div', { class: 'empty' }, h('p', { class: 'empty-title', text: title }), h('p', { text: hint }));

  function limitLine(label, n, key) {
    return isPro() ? null : kick(label + ' ' + n + ' из ' + C.limits[key], 'tiny');
  }

  /* ---------- страницы ---------- */

  const PAGES = {
    digest: pDigest, tasks: pTasks, notes: pNotes, food: pFood, money: pMoney,
    menu: pMenu, pro: pPro, subscriptions: pSubs, pay: pPay, settings: pSettings,
    archive: pArchive, support: pSupport, legal: pLegal
  };
  const TITLES = {
    digest: '', tasks: 'задачи', notes: 'заметки', food: 'еда', money: 'расходы', menu: 'меню', pro: 'pro',
    subscriptions: 'тарифы', pay: 'оплата', settings: 'настройки', archive: 'архив', support: 'поддержка', legal: 'документы'
  };
  const HUBS = ['digest', 'tasks', 'notes', 'food', 'money'];
  const TAB_LABEL = { digest: 'главная', tasks: 'задачи', notes: 'заметки', food: 'еда', money: 'расходы' };
  const PARENT = { menu: 'digest', pro: 'menu', subscriptions: 'pro', pay: 'subscriptions', settings: 'menu', archive: 'menu', support: 'menu', legal: 'menu' };

  /* digest: главный хаб */
  function pDigest() {
    const t0 = today(), now = new Date();
    const st = L.dayStats(S.tasks, t0);
    const pending = S.tasks.filter((t) => !t.done && t.due && t.due <= t0).sort(MIN_BY);
    const spent = S.money.filter((m) => m.kind === 'exp' && L.dkey(new Date(m.t)) === t0).reduce((a, m) => a + m.amount, 0);
    const pins = S.notes.filter((n) => n.pin && !n.archived).slice(0, 3);
    const root = h('div', { class: 'grid' });

    const fill = h('div', { class: 'bar-fill' });
    root.append(card('span2 dots',
      kick('прогресс дня'),
      h('p', { class: 'num' }, String(st.pct), h('small', { text: '%' })),
      h('div', { class: 'bar-track' }, fill),
      h('p', { class: 'cap', text: st.total ? st.done + ' из ' + st.total + ' ' + plural(st.total, 'задачи', 'задач', 'задач') + ' выполнено' : 'на сегодня задач нет' })
    ));
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = st.pct + '%'; }));

    root.append(
      card('tap', kick('осталось'), h('p', { class: 'num sm', text: String(st.open) }), h('p', { class: 'cap', text: plural(st.open, 'задача на сегодня', 'задачи на сегодня', 'задач на сегодня') })),
      card('tap', kick('потрачено'), h('p', { class: 'num sm' }, fmt(spent), h('small', { text: '₸' })), h('p', { class: 'cap', text: 'сегодня' }))
    );
    root.children[1].addEventListener('click', () => go('tasks'));
    root.children[2].addEventListener('click', () => go('money'));

    if (now.getHours() >= 18 && pending.length) {
      root.append(card('span2',
        kick('вечерний сброс'),
        h('p', { class: 'item-title', text: pending.length + ' ' + plural(pending.length, 'задача не выполнена', 'задачи не выполнены', 'задач не выполнено') }),
        h('div', { class: 'line', style: 'margin-top:12px' },
          h('button', { class: 'btn solid', type: 'button', text: 'перенести на завтра', onclick: () => {
            pending.forEach((t) => { t.due = tomorrow(); }); save(); toast('перенесено на завтра'); render(false);
          } }),
          h('button', { class: 'btn', type: 'button', text: 'выбрать', onclick: () => go('tasks') })
        )
      ));
    }

    const list = card('span2', kick('на сегодня'));
    if (pending.length) {
      pending.slice(0, 5).forEach((t) => list.append(h('div', { class: 'item' },
        h('button', { class: 'check', type: 'button', 'aria-label': 'выполнить: ' + t.title, onclick: () => { toggleTask(t); render(false); } }),
        h('div', { class: 'item-body' }, h('p', { class: 'item-title', text: t.title }), h('p', { class: 'item-meta', text: dueLabel(t.due, t.time) }))
      )));
      if (pending.length > 5) list.append(h('button', { class: 'link', type: 'button', text: 'ещё ' + (pending.length - 5), onclick: () => go('tasks') }));
    } else {
      list.append(h('p', { class: 'cap', text: 'Задач на сегодня нет. Нажми на кнопку микрофона и скажи, что нужно не забыть.' }));
    }
    root.append(list);

    const pinned = card('span2 dots', kick('закреплено'));
    if (pins.length) pins.forEach((n) => pinned.append(h('p', { class: 'item-text', style: 'margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden', text: n.text })));
    else pinned.append(h('p', { class: 'cap', text: 'Закрепи важные заметки, и они появятся здесь.' }));
    root.append(pinned);

    root.append(card('span2 tap',
      kick('подписка'),
      h('p', { class: 'item-title', text: isPro() ? 'Pro до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') : 'Бесплатный тариф' }),
      h('p', { class: 'cap', text: isPro() ? 'Все ограничения сняты.' : 'Pro снимает все ограничения: ' + fmt(C.price.month) + ' ₸ в месяц.' })
    ));
    root.lastChild.addEventListener('click', () => go('pro'));
    return root;
  }

  /* tasks */
  let openTaskId = null;
  const draft = { pri: 0, due: '', repeat: '' };

  function pTasks() {
    const root = h('div', { class: 'stack' });
    const t0 = today();

    const input = h('input', { class: 'field', placeholder: 'новая задача', maxlength: '120', enterkeyhint: 'done', 'aria-label': 'название задачи' });
    const due = h('input', { class: 'field', type: 'date', value: draft.due, 'aria-label': 'срок', onchange: (e) => { draft.due = e.target.value; } });
    const rep = h('select', { class: 'select', 'aria-label': 'повтор', value: draft.repeat, onchange: (e) => { draft.repeat = e.target.value; } },
      h('option', { value: '', text: 'не повторять' }),
      h('option', { value: 'daily', text: 'каждый день' }),
      h('option', { value: 'weekly', text: 'каждую неделю' }),
      h('option', { value: 'monthly', text: 'каждый месяц' })
    );
    const chips = h('div', { class: 'chips' }, PRI_LABEL.map((l, i) => h('button', {
      class: 'chip' + (draft.pri === i ? ' on' : ''), type: 'button', text: l,
      onclick: (e) => { draft.pri = i; chips.querySelectorAll('.chip').forEach((c, j) => c.classList.toggle('on', j === i)); }
    })));
    const add = () => {
      const title = input.value.trim();
      if (!title) { input.focus(); return; }
      if (addTask({ title: title, pri: draft.pri, due: draft.due, repeat: draft.repeat })) {
        draft.pri = 0; draft.due = ''; draft.repeat = '';
        render(false);
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.append(card('',
      h('div', { class: 'line' }, input, h('button', { class: 'btn solid', type: 'button', text: 'добавить', onclick: add })),
      h('div', { class: 'line', style: 'margin-top:8px' }, due, rep),
      h('div', { style: 'margin-top:10px' }, chips)
    ));

    const act = activeTasks().sort(MIN_BY);
    const lineEl = limitLine('активных', act.length, 'tasks');
    if (lineEl) root.append(lineEl);

    const groups = [
      ['на сегодня и раньше', act.filter((t) => t.due && t.due <= t0)],
      ['позже', act.filter((t) => t.due && t.due > t0)],
      ['без срока', act.filter((t) => !t.due)],
      ['выполнено сегодня', S.tasks.filter((t) => t.done && t.doneKey === t0)]
    ];
    let any = false;
    groups.forEach((g) => {
      if (!g[1].length) return;
      any = true;
      root.append(kick(g[0], 'section'), card('', g[1].map(taskItem)));
    });
    if (!any) root.append(empty('задач пока нет', 'Запиши первую выше или нажми на микрофон и скажи: «напомни завтра в 9 утра позвонить врачу».'));
    return root;
  }

  function taskItem(t) {
    const open = openTaskId === t.id && !t.done;
    const meta = h('p', { class: 'item-meta' });
    if (t.pri === 2) meta.append(h('span', { class: 'tag hot', text: 'срочно' }));
    else if (t.pri === 1) meta.append(h('span', { class: 'tag', text: 'важно' }));
    const bits = [];
    if (t.due) bits.push(dueLabel(t.due, t.time));
    if (t.repeat) bits.push(REPEAT_LABEL[t.repeat]);
    if (t.subs.length) bits.push(t.subs.filter((s) => s.done).length + ' из ' + t.subs.length + ' подзадач');
    meta.append(bits.join(', '));

    const head = h('div', { style: 'cursor:pointer', onclick: () => { openTaskId = open ? null : t.id; render(false); } },
      h('p', { class: 'item-title', text: t.title }), (bits.length || t.pri) ? meta : null);

    const body = h('div', { class: 'item-body' }, head);

    if (open) {
      const subInput = h('input', { class: 'field', placeholder: 'подзадача', maxlength: '80', 'aria-label': 'новая подзадача' });
      const addSub = () => {
        const v = subInput.value.trim();
        if (!v) return;
        if (t.subs.length >= lim('subs')) return limitHit('subs');
        t.subs.push({ t: v, done: false }); save(); render(false);
      };
      subInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
      body.append(
        t.subs.length ? h('div', { class: 'sub' }, t.subs.map((s, i) => h('div', { class: 'sub-row' + (s.done ? ' done' : '') },
          h('button', { class: 'check sq' + (s.done ? ' on' : ''), type: 'button', 'aria-label': 'подзадача: ' + s.t, onclick: () => { s.done = !s.done; save(); render(false); } }),
          h('span', { text: s.t, style: 'flex:1' }),
          h('button', { class: 'link', type: 'button', text: '×', 'aria-label': 'убрать подзадачу', onclick: () => { t.subs.splice(i, 1); save(); render(false); } })
        ))) : null,
        h('div', { class: 'line', style: 'margin-top:10px' }, subInput, h('button', { class: 'btn', type: 'button', text: '+', 'aria-label': 'добавить подзадачу', onclick: addSub })),
        h('div', { class: 'actions' },
          h('button', { class: 'link', type: 'button', text: 'на завтра', onclick: () => { t.due = tomorrow(); save(); render(false); } }),
          h('button', { class: 'link', type: 'button', text: 'приоритет: ' + PRI_LABEL[t.pri], onclick: () => { t.pri = (t.pri + 1) % 3; save(); render(false); } }),
          h('button', { class: 'link', type: 'button', text: 'повтор: ' + (t.repeat ? REPEAT_LABEL[t.repeat] : 'нет'), onclick: () => {
            const next = REPEAT[(REPEAT.indexOf(t.repeat || null) + 1) % REPEAT.length];
            if (next && !t.repeat && S.tasks.filter((x) => !x.done && x.repeat).length >= lim('repeats')) return limitHit('repeats');
            t.repeat = next; if (next && !t.due) t.due = today(); save(); render(false);
          } }),
          h('button', { class: 'link', type: 'button', text: 'удалить', onclick: () => {
            if (confirm('Удалить задачу «' + t.title + '»?')) { S.tasks = S.tasks.filter((x) => x !== t); save(); render(false); }
          } })
        )
      );
    }

    return h('div', { class: 'item' + (t.done ? ' done' : '') },
      h('button', { class: 'check' + (t.done ? ' on' : ''), type: 'button', 'aria-label': (t.done ? 'вернуть: ' : 'выполнить: ') + t.title, onclick: () => { toggleTask(t); render(false); } }),
      body
    );
  }

  /* notes */
  let noteCat = '', noteQuery = '', editingNote = null, showCatForm = false;

  function pNotes() {
    const root = h('div', { class: 'stack' });
    const area = h('textarea', { class: 'area', rows: '3', placeholder: 'новая заметка', 'aria-label': 'текст заметки' });
    const sel = h('select', { class: 'select', 'aria-label': 'категория', value: noteCat },
      h('option', { value: '', text: 'без категории' }),
      S.cats.map((c) => h('option', { value: c, text: c }))
    );
    const add = () => {
      const text = area.value.trim();
      if (!text) { area.focus(); return; }
      if (addNote(L.cap(text), sel.value)) { render(false); }
    };
    const catInput = h('input', { class: 'field', placeholder: 'новая категория', maxlength: '30', 'aria-label': 'название категории' });
    const addCategory = () => {
      const name = addCat(catInput.value);
      if (name) { noteCat = name; showCatForm = false; render(false); }
    };
    catInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } });

    root.append(card('',
      area,
      h('div', { class: 'line', style: 'margin-top:8px' }, sel, h('button', { class: 'btn solid', type: 'button', text: 'сохранить', onclick: add })),
      showCatForm ? h('div', { class: 'line', style: 'margin-top:8px' }, catInput, h('button', { class: 'btn', type: 'button', text: 'создать', onclick: addCategory })) : null,
      h('button', { class: 'link', type: 'button', style: 'margin-top:4px;margin-left:-10px', text: showCatForm ? 'скрыть' : '+ категория', onclick: () => { showCatForm = !showCatForm; render(false); } })
    ));

    const count = S.notes.filter((n) => !n.archived).length;
    const ll = limitLine('заметок', count, 'notes');
    if (ll) root.append(ll);

    const search = h('input', { class: 'field', type: 'search', placeholder: 'поиск по тексту, категории, дате', value: noteQuery, 'aria-label': 'поиск' });
    const box = h('div', { class: 'stack' });
    search.addEventListener('input', () => { noteQuery = search.value; fillNotes(box); });
    root.append(search);

    if (S.cats.length) {
      const chips = h('div', { class: 'chips' },
        h('button', { class: 'chip' + (!noteCat ? ' on' : ''), type: 'button', text: 'все', onclick: () => { noteCat = ''; render(false); } }),
        S.cats.map((c) => h('button', { class: 'chip' + (noteCat === c ? ' on' : ''), type: 'button', text: c, onclick: () => { noteCat = c; render(false); } }))
      );
      root.append(chips);
      if (noteCat) root.append(h('div', null, h('button', { class: 'link', type: 'button', style: 'margin-left:-10px', text: 'удалить категорию «' + noteCat + '»', onclick: () => {
        if (confirm('Удалить категорию «' + noteCat + '»? Заметки останутся без категории.')) {
          S.notes.forEach((n) => { if (n.cat === noteCat) n.cat = ''; });
          S.cats = S.cats.filter((c) => c !== noteCat); noteCat = ''; save(); render(false);
        }
      } })));
    }

    fillNotes(box);
    root.append(box);
    return root;
  }

  function fillNotes(box) {
    box.replaceChildren();
    const q = noteQuery.trim().toLowerCase();
    const list = S.notes.filter((n) => !n.archived)
      .filter((n) => !noteCat || n.cat === noteCat)
      .filter((n) => {
        if (!q) return true;
        const d = new Date(n.t);
        const ds = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
        return n.text.toLowerCase().includes(q) || (n.cat || '').toLowerCase().includes(q) || ds.includes(q);
      })
      .sort((a, b) => (b.pin - a.pin) || (b.t - a.t));
    if (!list.length) {
      box.append(empty(S.notes.length ? 'ничего не найдено' : 'заметок пока нет',
        S.notes.length ? 'Попробуй другое слово или сбрось категорию.' : 'Напиши заметку выше или нажми на микрофон и просто говори.'));
      return;
    }
    list.forEach((n) => box.append(noteCard(n)));
  }

  function noteCard(n) {
    const head = h('p', { class: 'kicker' }, stampOf(n.t),
      n.cat ? h('span', { class: 'tag', style: 'margin-left:10px', text: n.cat }) : null,
      n.pin ? h('span', { class: 'tag hot', style: 'margin-left:6px', text: 'закреплено' }) : null);
    if (editingNote === n.id) {
      const ta = h('textarea', { class: 'area', rows: String(Math.min(10, Math.max(3, Math.ceil(n.text.length / 34)))), value: n.text, 'aria-label': 'текст заметки' });
      setTimeout(() => ta.focus(), 0);
      return card('', head, h('div', { style: 'margin-top:10px' }, ta),
        h('div', { class: 'actions' },
          h('button', { class: 'link', type: 'button', text: 'сохранить', onclick: () => { const v = ta.value.trim(); if (v) { n.text = v; save(); } editingNote = null; render(false); } }),
          h('button', { class: 'link', type: 'button', text: 'отмена', onclick: () => { editingNote = null; render(false); } })));
    }
    return card(n.pin ? 'dots' : '', head,
      h('p', { class: 'item-text', style: 'margin-top:8px', text: n.text }),
      h('div', { class: 'actions' },
        h('button', { class: 'link', type: 'button', text: n.pin ? 'открепить' : 'закрепить', onclick: () => {
          if (!n.pin && S.notes.filter((x) => x.pin && !x.archived).length >= lim('pins')) return limitHit('pins');
          n.pin = !n.pin; save(); render(false);
        } }),
        h('button', { class: 'link', type: 'button', text: 'править', onclick: () => { editingNote = n.id; render(false); } }),
        h('button', { class: 'link', type: 'button', text: 'копировать', onclick: () => {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(n.text).then(() => toast('скопировано'), () => {});
        } }),
        h('button', { class: 'link', type: 'button', text: 'в архив', onclick: () => { n.archived = true; n.pin = false; n.archivedAt = Date.now(); save(); render(false); } }),
        h('button', { class: 'link', type: 'button', text: 'удалить', onclick: () => {
          if (confirm('Удалить заметку?')) { S.notes = S.notes.filter((x) => x !== n); save(); render(false); }
        } })
      ));
  }

  /* food */
  function pFood() {
    const root = h('div', { class: 'stack' });
    const t0 = today();
    const text = h('input', { class: 'field', placeholder: 'что съел', maxlength: '80', enterkeyhint: 'done', 'aria-label': 'название блюда' });
    const kcal = h('input', { class: 'field', type: 'number', inputmode: 'numeric', placeholder: 'ккал', style: 'max-width:110px', 'aria-label': 'калории' });
    const add = () => {
      const v = text.value.trim();
      if (!v) { text.focus(); return; }
      S.meals.unshift({ id: uid(), text: L.cap(v), kcal: Number(kcal.value) || 0, t: Date.now() });
      save(); render(false);
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.append(card('', h('div', { class: 'line' }, text, kcal), h('button', { class: 'btn solid block', type: 'button', style: 'margin-top:8px', text: 'добавить', onclick: add })));

    const todayMeals = S.meals.filter((m) => L.dkey(new Date(m.t)) === t0);
    const total = todayMeals.reduce((a, m) => a + m.kcal, 0);
    root.append(card('dots', kick('сегодня'), h('p', { class: 'num' }, fmt(total), h('small', { text: 'ккал' })), h('p', { class: 'cap', text: todayMeals.length + ' ' + plural(todayMeals.length, 'приём пищи', 'приёма пищи', 'приёмов пищи') })));

    if (todayMeals.length) {
      root.append(card('', todayMeals.map((m) => h('div', { class: 'item' },
        h('div', { class: 'item-body' }, h('p', { class: 'item-title', text: m.text }), h('p', { class: 'item-meta', text: pad(new Date(m.t).getHours()) + ':' + pad(new Date(m.t).getMinutes()) + (m.kcal ? ', ' + m.kcal + ' ккал' : '') })),
        h('button', { class: 'link', type: 'button', text: '×', 'aria-label': 'удалить: ' + m.text, onclick: () => { S.meals = S.meals.filter((x) => x !== m); save(); render(false); } })
      ))));
    } else {
      root.append(empty('сегодня ещё ничего', 'Записывай еду текстом или скажи через микрофон: «съел гречку с курицей».'));
    }

    const days = [];
    for (let i = 1; i <= 6; i++) {
      const k = L.dkey(L.addDays(new Date(), -i));
      const ms = S.meals.filter((m) => L.dkey(new Date(m.t)) === k);
      if (ms.length) days.push([k, ms.length, ms.reduce((a, m) => a + m.kcal, 0)]);
    }
    if (days.length) {
      root.append(kick('прошлые дни', 'section'), card('', days.map((d) => {
        const dt = L.fromKey(d[0]);
        return h('div', { class: 'kv' }, h('span', { text: dt.getDate() + ' ' + MON_SHORT[dt.getMonth()] }), h('span', { class: 'muted', text: d[1] + ' зап., ' + fmt(d[2]) + ' ккал' }));
      })));
    }
    return root;
  }

  /* money */
  let moneyKind = 'exp';
  function pMoney() {
    const root = h('div', { class: 'stack' });
    const month = monthMoney();
    const exp = month.filter((m) => m.kind === 'exp').reduce((a, m) => a + m.amount, 0);
    const inc = month.filter((m) => m.kind === 'inc').reduce((a, m) => a + m.amount, 0);
    const bal = inc - exp;

    root.append(card('dots',
      kick(MONTHS[new Date().getMonth()] + ': баланс'),
      h('p', { class: 'num' }, (bal < 0 ? '−' : '') + fmt(Math.abs(bal)), h('small', { text: '₸' })),
      h('div', { class: 'grid', style: 'margin-top:14px' },
        h('div', null, kick('доходы'), h('p', { class: 'item-title', text: fmt(inc) + ' ₸' })),
        h('div', null, kick('расходы'), h('p', { class: 'item-title', text: fmt(exp) + ' ₸' }))
      )
    ));

    const amount = h('input', { class: 'field', type: 'number', inputmode: 'decimal', placeholder: 'сумма, ₸', 'aria-label': 'сумма' });
    const text = h('input', { class: 'field', placeholder: 'на что или откуда', maxlength: '60', enterkeyhint: 'done', 'aria-label': 'описание' });
    const chips = h('div', { class: 'chips' }, [['exp', 'расход'], ['inc', 'доход']].map((k) => h('button', {
      class: 'chip' + (moneyKind === k[0] ? ' on' : ''), type: 'button', text: k[1],
      onclick: () => { moneyKind = k[0]; chips.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', ['exp', 'inc'][i] === moneyKind)); }
    })));
    const add = () => {
      const v = Number(amount.value);
      if (!(v > 0)) { amount.focus(); return; }
      if (addMoney(moneyKind, v, text.value.trim())) render(false);
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.append(card('', h('div', { style: 'margin-bottom:10px' }, chips), h('div', { class: 'line' }, amount, text),
      h('button', { class: 'btn solid block', type: 'button', style: 'margin-top:8px', text: 'добавить', onclick: add })));

    const ll = limitLine('записей в месяце', month.length, 'moneyMonth');
    if (ll) root.append(ll);

    if (month.length) {
      root.append(card('', month.map((m) => h('div', { class: 'item' },
        h('div', { class: 'item-body' }, h('p', { class: 'item-title figure', text: (m.kind === 'exp' ? '−' : '+') + fmt(m.amount) + ' ₸' }), h('p', { class: 'item-meta', text: stampOf(m.t) + (m.text ? ', ' + m.text : '') })),
        h('button', { class: 'link', type: 'button', text: '×', 'aria-label': 'удалить запись', onclick: () => { S.money = S.money.filter((x) => x !== m); save(); render(false); } })
      ))));
    } else {
      root.append(empty('записей за месяц нет', 'Добавь вручную или скажи: «купил хлеб за 500 тенге».'));
    }
    return root;
  }

  /* menu и остальные страницы вне нижней панели */
  function pMenu() {
    const rows = [
      ['pro', 'подписка pro', isPro() ? 'активна до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') : 'бесплатный тариф'],
      ['subscriptions', 'тарифы', fmt(C.price.month) + ' ₸ в месяц'],
      ['pay', 'оплата', 'перевод и код активации'],
      ['archive', 'архив', 'выполненные задачи и старые заметки'],
      ['settings', 'настройки', 'данные на этом телефоне'],
      ['support', 'поддержка', 'написать нам'],
      ['legal', 'документы', 'конфиденциальность и условия']
    ];
    const root = h('div', { class: 'stack' });
    rows.forEach((r) => {
      const c = card('tap menu-row', h('div', null, h('p', { class: 'item-title', text: r[1] }), h('p', { class: 'item-meta', text: r[2] })), h('span', { class: 'arrow', text: '›' }));
      c.addEventListener('click', () => go(r[0]));
      root.append(c);
    });
    root.append(h('p', { class: 'foot', text: 'Создано @bauyrzhanov_12_' }));
    return root;
  }

  function pPro() {
    const root = h('div', { class: 'stack' });
    root.append(card('dots',
      kick('статус'),
      h('p', { class: 'num sm', text: isPro() ? 'Pro' : 'Free' }),
      h('p', { class: 'cap', text: isPro() ? 'Подписка действует до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') + '. Все ограничения сняты.' : 'Бесплатный тариф с лимитами. Pro снимает все ограничения приложения.' })
    ));
    root.append(card('',
      kick('что даёт pro'),
      h('ul', { class: 'plan' },
        h('li', { text: 'Без лимитов на заметки, задачи, категории, повторы и подзадачи' }),
        h('li', { text: 'Без лимитов на голосовой ввод и голосовой выбор категории' }),
        h('li', { text: 'Финансы без ограничения записей в месяц' }),
        h('li', { text: 'Архив без ограничения по размеру' })
      )
    ));
    root.append(h('div', { class: 'line' },
      h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: 'тарифы', onclick: () => go('subscriptions') }),
      h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'ввести код', onclick: () => go('pay') })
    ));
    return root;
  }

  function pSubs() {
    const root = h('div', { class: 'stack' });
    const yearFull = C.price.month * 12;
    const off = Math.round((1 - C.price.year / yearFull) * 100);

    root.append(card('',
      kick('бесплатно'),
      h('p', { class: 'num sm' }, '0', h('small', { text: '₸' })),
      h('ul', { class: 'plan' }, C.freePlan.map((f) => h('li', { class: f.soon ? 'soon' : '', text: f.text + (f.soon ? ' (скоро)' : '') })))
    ));
    root.append(card('dots',
      kick('pro на месяц'),
      h('p', { class: 'num sm' }, fmt(C.price.month), h('small', { text: '₸ в месяц' })),
      h('p', { class: 'cap', text: 'Как стакан кофе. Все ограничения сняты.' })
    ));
    root.append(card('dots',
      kick('pro на год'),
      h('p', { class: 'num sm' }, fmt(C.price.year), h('small', { text: '₸ в год' })),
      h('p', { class: 'cap', text: 'Выгоднее на ' + off + '% против оплаты помесячно (' + fmt(yearFull) + ' ₸).' })
    ));
    root.append(h('button', { class: 'btn solid block', type: 'button', text: 'как оплатить', onclick: () => go('pay') }));
    return root;
  }

  let payPlan = 'month';
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function pPay() {
    const root = h('div', { class: 'stack' });
    const amountEl = h('p', { class: 'num sm' });
    const setAmount = () => { amountEl.replaceChildren(fmt(C.price[payPlan]), h('small', { text: '₸' })); };
    setAmount();
    const chips = h('div', { class: 'chips' }, [['month', 'месяц'], ['year', 'год']].map((k) => h('button', {
      class: 'chip' + (payPlan === k[0] ? ' on' : ''), type: 'button', text: k[1],
      onclick: () => { payPlan = k[0]; setAmount(); chips.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', ['month', 'year'][i] === payPlan)); }
    })));
    const k = C.kaspi || {};
    root.append(card('dots',
      kick('перевод на kaspi'), h('div', { style: 'margin-top:10px' }, chips), amountEl,
      k.card
        ? h('div', null, h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'карта' }), h('span', { text: k.card })), k.holder ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'получатель' }), h('span', { text: k.holder })) : null)
        : h('p', { class: 'cap', text: 'Реквизиты для перевода пришлём в поддержке.' })
    ));
    root.append(card('',
      kick('как это работает'),
      h('ol', { class: 'steps' },
        h('li', { text: 'Переведи сумму тарифа.' }),
        h('li', { text: 'Отправь чек в поддержку.' }),
        h('li', { text: 'Получи код активации и введи его ниже.' })
      ),
      h('a', { class: 'btn block', style: 'display:grid;place-items:center;margin-top:14px;text-decoration:none', href: 'https://t.me/' + C.support.handle, target: '_blank', rel: 'noopener', text: 'написать в поддержку' })
    ));

    const code = h('input', { class: 'field', placeholder: 'DDX-M-XXXX-XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'код активации' });
    const msg = h('p', { class: 'cap', role: 'status' });
    const activate = async () => {
      const norm = L.normCode(code.value);
      if (!norm) { code.focus(); return; }
      if (!(window.crypto && crypto.subtle)) { msg.textContent = 'Проверка кода недоступна в этом режиме. Открой приложение по https-ссылке.'; return; }
      const hash = await sha256(norm);
      const days = C.codes[hash];
      if (!days) { msg.textContent = 'Код не подошёл. Проверь, нет ли опечатки.'; return; }
      if (S.pro.used.includes(hash)) { msg.textContent = 'Этот код уже активирован на этом устройстве.'; return; }
      S.pro.until = Math.max(Date.now(), S.pro.until) + days * 86400000;
      S.pro.used.push(hash);
      save();
      toast('pro активирован');
      render(false);
    };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); activate(); } });
    root.append(card('',
      kick('код активации'),
      isPro() ? h('p', { class: 'cap', text: 'Pro действует до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') + '. Новый код продлит подписку.' }) : null,
      h('div', { class: 'line', style: 'margin-top:12px' }, code, h('button', { class: 'btn solid', type: 'button', text: 'активировать', onclick: activate })),
      msg
    ));
    return root;
  }

  function pSettings() {
    const root = h('div', { class: 'stack' });
    const nameIn = h('input', { class: 'field', value: S.name, placeholder: 'твоё имя', maxlength: '24', autocomplete: 'given-name', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'имя' });
    const saveName = () => {
      const n = L.cleanName(nameIn.value);
      if (!n) { toast('введи имя'); nameIn.focus(); return; }
      S.name = n; save(); toast('имя сохранено'); render(false);
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
    root.append(card('',
      kick('имя'),
      h('p', { class: 'cap', text: 'Так приложение здоровается с тобой на главной.' }),
      h('div', { class: 'line', style: 'margin-top:12px' }, nameIn, h('button', { class: 'btn solid', type: 'button', text: 'сохранить', onclick: saveName }))
    ));
    const rows = [
      ['активных задач', activeTasks().length], ['выполненных задач', S.tasks.filter((t) => t.done).length],
      ['заметок', S.notes.filter((n) => !n.archived).length], ['категорий', S.cats.length],
      ['записей еды', S.meals.length], ['записей доходов и расходов', S.money.length]
    ];
    root.append(card('', kick('данные на этом телефоне'), h('div', { style: 'margin-top:10px' }, rows.map((r) => h('div', { class: 'kv' }, h('span', { text: r[0] }), h('span', { class: 'muted', text: String(r[1]) }))))));
    root.append(card('',
      kick('подписка'),
      h('p', { class: 'item-title', style: 'margin-top:8px', text: isPro() ? 'Pro до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') : 'Бесплатный тариф' })
    ));
    root.append(card('', kick('управление'),
      h('div', { class: 'form', style: 'margin-top:12px' },
        h('button', { class: 'btn block', type: 'button', text: 'скопировать все данные', onclick: () => {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(JSON.stringify(S, null, 2)).then(() => toast('данные скопированы'), () => toast('не удалось скопировать'));
        } }),
        h('button', { class: 'btn block', type: 'button', text: 'стереть данные', onclick: () => {
          if (confirm('Стереть все задачи, заметки, еду и расходы на этом телефоне? Имя и подписка Pro сохранятся.')) {
            const keep = { pro: S.pro, name: S.name }; S = blank(); S.pro = keep.pro; S.name = keep.name; save(); toast('данные стёрты'); render(false);
          }
        } })
      )
    ));
    root.append(h('p', { class: 'foot', text: 'Все данные хранятся только на этом устройстве. Создано @bauyrzhanov_12_' }));
    return root;
  }

  function pArchive() {
    const root = h('div', { class: 'stack' });
    const items = []
      .concat(S.tasks.filter((t) => t.done).map((t) => ({ kind: 'task', ref: t, ts: t.doneAt || 0, title: t.title })))
      .concat(S.notes.filter((n) => n.archived).map((n) => ({ kind: 'note', ref: n, ts: n.archivedAt || n.t, title: n.text })))
      .sort((a, b) => b.ts - a.ts);
    const max = lim('archive');
    const shown = items.slice(0, max);
    if (!items.length) { root.append(empty('архив пуст', 'Сюда попадают выполненные задачи и заметки, которые ты отправил в архив.')); return root; }
    if (items.length > shown.length) root.append(kick('показаны последние ' + max + ' из ' + items.length + '. Pro хранит всё', 'section'));
    root.append(card('', shown.map((it) => h('div', { class: 'item' },
      h('div', { class: 'item-body' },
        h('p', { class: 'item-title', style: 'font-size:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden', text: it.title }),
        h('p', { class: 'item-meta', text: (it.kind === 'task' ? 'задача' : 'заметка') + ', ' + stampOf(it.ts) })),
      h('button', { class: 'link', type: 'button', text: 'вернуть', onclick: () => {
        if (it.kind === 'task') toggleTask(it.ref); else { it.ref.archived = false; save(); }
        render(false);
      } })
    ))));
    return root;
  }

  function pSupport() {
    const root = h('div', { class: 'stack' });
    root.append(card('dots',
      kick('написать нам'),
      h('p', { class: 'item-title', style: 'margin-top:8px', text: '@' + C.support.handle }),
      h('p', { class: 'cap', text: 'Вопросы по приложению, оплате и кодам активации.' }),
      h('a', { class: 'btn solid block', style: 'display:grid;place-items:center;margin-top:14px;text-decoration:none', href: 'https://t.me/' + C.support.handle, target: '_blank', rel: 'noopener', text: 'открыть telegram' })
    ));
    root.append(card('',
      kick('частые вопросы'),
      h('p', { class: 'item-title', style: 'margin-top:10px', text: 'Не работает запись голосом' }),
      h('p', { class: 'cap', text: 'Распознавание речи лучше работает в Safari. В приложении с экрана «Домой» iOS иногда блокирует его. Тогда нажми на микрофон на клавиатуре в поле ввода.' }),
      h('p', { class: 'item-title', style: 'margin-top:16px', text: 'Пропали данные' }),
      h('p', { class: 'cap', text: 'Данные хранятся на телефоне. Если удалить приложение с экрана или очистить данные сайта в Safari, они исчезнут. Скопируй их заранее в настройках.' })
    ));
    return root;
  }

  function pLegal() {
    const root = h('div', { class: 'stack' });
    root.append(card('',
      kick('конфиденциальность'),
      h('p', { class: 'cap', style: 'color:var(--ink)', text: 'Задачи, заметки, записи еды и расходов хранятся только на твоём телефоне. Мы не отправляем их на сервер и не видим их.' }),
      h('p', { class: 'cap', style: 'color:var(--ink)', text: 'При голосовом вводе речь распознаёт сервис твоего браузера (Safari использует сервис Apple). Это происходит вне приложения.' })
    ));
    root.append(card('',
      kick('условия'),
      h('p', { class: 'cap', style: 'color:var(--ink)', text: 'Приложение предоставляется как есть. Подписка Pro даёт доступ ко всем функциям на срок, оплаченный кодом активации. Код действует на устройствах, где его ввели.' }),
      h('p', { class: 'cap', text: 'Черновик. Перед публичным запуском проверь тексты у юриста.' })
    ));
    return root;
  }

  /* ---------- маршруты, шапка, панель ---------- */

  let route = 'digest';
  function currentRoute() {
    const r = location.hash.replace(/^#\/?/, '') || 'digest';
    return PAGES[r] ? r : 'digest';
  }
  function go(r) {
    if (location.hash === '#/' + r) render(true); else location.hash = '#/' + r;
  }
  window.addEventListener('hashchange', () => render(true));

  function buildTabs() {
    const nav = $('#tabs');
    nav.append(h('span', { class: 'tab-ind', id: 'tab-ind' }));
    HUBS.forEach((r) => {
      nav.append(h('button', { class: 'tab', type: 'button', 'data-r': r, 'aria-label': TAB_LABEL[r], onclick: () => go(r) }, icon(r), h('span', { text: TAB_LABEL[r] })));
    });
  }
  function updateTabs() {
    const ind = $('#tab-ind');
    let active = null;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.r === route;
      b.classList.toggle('on', on);
      if (on) { active = b; b.setAttribute('aria-current', 'page'); } else b.removeAttribute('aria-current');
    });
    if (active) {
      ind.style.width = active.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + active.offsetLeft + 'px)';
      ind.classList.add('has');
    } else ind.classList.remove('has');
  }

  function render(animate) {
    route = currentRoute();
    const d = new Date();

    if (route === 'digest') {
      // приветствие по времени суток и имя
      $('#kicker').textContent = WEEKDAYS_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
      const kids = [h('span', { class: 'g', text: L.greeting(d) + (S.name ? ',' : '') })];
      if (S.name) kids.push(h('span', { class: 'who', text: S.name }));
      $('#title').replaceChildren.apply($('#title'), kids);
    } else {
      $('#kicker').textContent = 'ddx planner';
      $('#title').textContent = TITLES[route];
    }

    const btn = $('#bar-btn');
    const isHub = HUBS.includes(route);
    btn.replaceChildren(icon(isHub ? 'menu' : 'back'));
    btn.setAttribute('aria-label', isHub ? 'меню' : 'назад');
    btn.onclick = () => go(isHub ? 'menu' : PARENT[route]);

    const page = PAGES[route]();
    if (animate) {
      page.classList.add('enter');
      Array.prototype.forEach.call(page.children, (c, i) => c.style.setProperty('--i', i));
      window.scrollTo(0, 0);
    }
    $('#view').replaceChildren(page);
    updateTabs();
  }

  /* ---------- быстрый ввод голосом ---------- */

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, cur = { final: '', interim: '' }, lastError = '', startedAt = 0, timer = null;

  function collect(results) {
    let f = '', i = '';
    for (let n = 0; n < results.length; n++) {
      const r = results[n], t = (r && r[0] && r[0].transcript) || '';
      if (r.isFinal) f += t; else i += t;
    }
    return { final: f, interim: i };
  }

  function renderLive() {
    const box = $('#live-text');
    box.replaceChildren();
    if (cur.final) box.append(h('span', { text: cur.final }));
    if (cur.interim) box.append(h('span', { class: 'int', text: cur.interim }));
    if (!cur.final && !cur.interim) box.append(h('span', { class: 'int', text: 'говори, я слушаю' }));
  }

  function setListening(on) {
    listening = on;
    const fab = $('#fab');
    fab.classList.toggle('on', on);
    fab.setAttribute('aria-pressed', on ? 'true' : 'false');
    fab.replaceChildren(icon(on ? 'stop' : 'mic'));
    fab.setAttribute('aria-label', on ? 'остановить запись' : 'быстрый ввод голосом');
    $('#live').hidden = !on;
  }

  function startCapture() {
    if (!SR) { openCapture('', false); return; }
    if (!isPro() && usage().voice >= C.limits.voiceDay) { limitHit('voiceDay'); return; }
    cur = { final: '', interim: '' };
    lastError = '';
    try {
      rec = new SR();
      rec.lang = 'ru-RU';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => { cur = collect(e.results); renderLive(); };
      rec.onerror = (e) => { lastError = e.error || 'error'; };
      rec.onend = finishCapture;
      rec.start();
    } catch (err) { openCapture('', false); return; }
    startedAt = Date.now();
    $('#live-time').textContent = '0:00';
    timer = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      $('#live-time').textContent = Math.floor(sec / 60) + ':' + pad(sec % 60);
      if (!isPro() && sec >= C.limits.voiceSeconds) { toast('запись остановлена: в бесплатном тарифе до 2 минут'); stopCapture(); }
    }, 500);
    setListening(true);
    renderLive();
  }

  function stopCapture() {
    if (rec) { try { rec.stop(); } catch (e) { finishCapture(); } }
  }

  function finishCapture() {
    if (!listening) return;
    clearInterval(timer);
    setListening(false);
    rec = null;
    const text = (cur.final + ' ' + cur.interim).replace(/\s+/g, ' ').trim();
    if (text) { openCapture(text, true); return; }
    if (lastError === 'not-allowed' || lastError === 'service-not-allowed') {
      toast('нет доступа к распознаванию речи, продиктуй текстом с клавиатуры');
      openCapture('', false);
    } else if (lastError === 'network') toast('нет связи с сервисом распознавания');
    else toast('речи не слышно, попробуй ещё раз');
  }

  $('#fab').addEventListener('click', () => { if (listening) stopCapture(); else startCapture(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) stopCapture();
    else if (!document.hidden) render(false);
  });

  // лист «куда сохранить»: приложение предлагает тип, ты можешь поменять
  function openCapture(text, fromVoice) {
    const p = L.parseCapture(text);
    let type = p.type;
    const st = { text: p.text || text, cat: p.cat || '', due: p.due || '', time: p.time || '', pri: p.pri || 0, amount: p.amount || '' };
    const TYPES = [['note', 'заметка'], ['task', 'задача'], ['expense', 'расход'], ['income', 'доход']];

    openSheet((panel) => {
      const draw = () => {
        panel.replaceChildren();
        const ta = h('textarea', { class: 'area', rows: '3', value: st.text, placeholder: fromVoice ? '' : 'Нажми на микрофон на клавиатуре, чтобы продиктовать', 'aria-label': 'текст', oninput: (e) => { st.text = e.target.value; } });
        const fields = [];
        if (type === 'note') {
          const opts = S.cats.slice();
          if (st.cat && !opts.includes(st.cat)) opts.push(st.cat);
          fields.push(h('select', { class: 'select', 'aria-label': 'категория', value: st.cat, onchange: (e) => { st.cat = e.target.value; } },
            h('option', { value: '', text: 'без категории' }),
            opts.map((c) => h('option', { value: c, text: S.cats.includes(c) ? c : c + ' (новая)' }))));
        } else if (type === 'task') {
          fields.push(h('div', { class: 'line' },
            h('input', { class: 'field', type: 'date', value: st.due, 'aria-label': 'срок', onchange: (e) => { st.due = e.target.value; } }),
            h('input', { class: 'field', type: 'time', value: st.time, 'aria-label': 'время', style: 'max-width:130px', onchange: (e) => { st.time = e.target.value; } })));
          fields.push(h('div', { class: 'chips' }, PRI_LABEL.map((l, i) => h('button', {
            class: 'chip' + (st.pri === i ? ' on' : ''), type: 'button', text: l,
            onclick: (e) => { st.pri = i; e.target.parentNode.querySelectorAll('.chip').forEach((c, j) => c.classList.toggle('on', j === i)); }
          }))));
        } else {
          fields.push(h('input', { class: 'field', type: 'number', inputmode: 'decimal', placeholder: 'сумма, ₸', value: st.amount, 'aria-label': 'сумма', oninput: (e) => { st.amount = e.target.value; } }));
        }
        panel.append(
          h('h2', { text: 'сохранить как' }),
          h('div', { class: 'chips', style: 'margin-top:12px' }, TYPES.map((t) => h('button', {
            class: 'chip' + (type === t[0] ? ' on' : ''), type: 'button', text: t[1],
            onclick: () => { type = t[0]; draw(); }
          }))),
          h('div', { class: 'form' }, ta, fields,
            h('div', { class: 'line' },
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'отмена', onclick: closeSheet }),
              h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: 'сохранить', onclick: commit })))
        );
      };

      const commit = () => {
        const body = st.text.trim();
        if (!body) { toast('нечего сохранять'); return; }
        let ok = false, label = '';
        if (type === 'note') {
          let cat = st.cat;
          if (cat && fromVoice && p.cat && !isPro() && usage().voiceCat >= C.limits.voiceCatDay) { toast('лимит голосового выбора категории, сохранено без категории'); cat = ''; }
          else if (cat && !S.cats.includes(cat)) cat = addCat(cat);
          ok = addNote(L.cap(body), cat);
          if (ok && cat && fromVoice && p.cat) usage().voiceCat++;
          label = 'заметка';
        } else if (type === 'task') {
          ok = addTask({ title: L.cap(body), pri: st.pri, due: st.due, time: st.time });
          label = 'задача';
        } else {
          const amount = Number(st.amount);
          if (!(amount > 0)) { toast('укажи сумму'); return; }
          ok = addMoney(type === 'expense' ? 'exp' : 'inc', amount, L.cap(body));
          label = type === 'expense' ? 'расход' : 'доход';
        }
        if (ok) {
          if (fromVoice) usage().voice++;
          save();
          closeSheet();
          toast('сохранено: ' + label);
          render(false);
        }
      };

      draw();
    });
  }

  /* ---------- первый запуск: как тебя зовут ---------- */

  function askName() {
    openSheet((panel) => {
      const input = h('input', { class: 'field', placeholder: 'твоё имя', maxlength: '24', autocomplete: 'given-name', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'имя' });
      const preview = h('p', { class: 'cap', role: 'status' });
      const next = h('button', { class: 'btn solid block', type: 'button', text: 'продолжить', disabled: true });
      const update = () => {
        const n = L.cleanName(input.value);
        next.disabled = !n;
        preview.textContent = n ? L.greeting(new Date()) + ', ' + n : 'Так приложение будет здороваться с тобой.';
      };
      const done = () => {
        const n = L.cleanName(input.value);
        if (!n) return;
        S.name = n; save(); closeSheet(); render(true);
      };
      input.addEventListener('input', update);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
      next.addEventListener('click', done);
      panel.append(
        h('h2', { text: 'как тебя зовут?' }),
        h('p', { class: 'cap', text: 'Имя можно поменять потом в настройках.' }),
        h('div', { class: 'form', style: 'margin-top:14px' }, input, preview, next)
      );
      update();
      setTimeout(() => input.focus(), 400);
    }, true);
  }

  /* ---------- запуск ---------- */

  buildTabs();
  $('#fab').append(icon('mic'));
  render(true);
  if (!S.name) askName();
  // шрифт и размеры панели устанавливаются позже первого кадра
  requestAnimationFrame(updateTabs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateTabs);
  window.addEventListener('resize', updateTabs);
})();
