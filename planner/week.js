/* итог недели: считается на телефоне, день и время итога настраиваются; тема приложения */
(function () {
  'use strict';
  const D = window.DDX, L = D.L;
  const { h, icon, card, tapCard, label, section, chips, today, fmt, plural, go, save, toast, refresh } = D;

  const DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'вс']];
  const DAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  const PARTS = [['tasks', 'задачи'], ['money', 'деньги'], ['focus', 'фокус'], ['habits', 'привычки'], ['food', 'еда и вода'], ['notes', 'заметки']];

  function cfg() {
    const s = D.S.settings;
    s.week = Object.assign({ on: true, day: 0, hour: 20, notify: true }, s.week);
    s.week.parts = Object.assign({ tasks: true, money: true, focus: true, habits: true, food: true, notes: true }, s.week.parts);
    return s.week;
  }

  /* ---------- период ---------- */

  // последний момент итога: ближайший к «сейчас» день недели и час в прошлом
  function lastReport(now) {
    const c = cfg(), d = new Date(now);
    d.setHours(c.hour, 0, 0, 0);
    let back = (d.getDay() - c.day + 7) % 7;
    d.setDate(d.getDate() - back);
    if (d.getTime() > now) d.setDate(d.getDate() - 7);
    return d;
  }
  // 7 дней, заканчивающихся днём итога; offset -1 это неделя раньше
  function period(offset) {
    const end = L.addDays(lastReport(Date.now()), -7 * (offset || 0));
    return { end: end, a: L.dkey(L.addDays(end, -6)), b: L.dkey(end), ts: end.getTime() };
  }
  const dm = (k) => { const d = L.fromKey(k); return D.pad(d.getDate()) + '.' + D.pad(d.getMonth() + 1); };
  const inR = (k, p) => k >= p.a && k <= p.b;
  const keyOf = (ts) => L.dkey(new Date(ts));

  /* ---------- подсчёт ---------- */

  function calc(p) {
    const S = D.S, days = [];
    for (let i = 6; i >= 0; i--) days.push(L.dkey(L.addDays(L.fromKey(p.b), -i)));
    const r = { days: days };

    const done = S.tasks.filter((t) => t.done && t.doneKey && inR(t.doneKey, p));
    const perDay = days.map((k) => done.filter((t) => t.doneKey === k).length);
    const open = S.tasks.filter((t) => !t.done && t.due && inR(t.due, p));
    const best = perDay.indexOf(Math.max.apply(null, perDay));
    r.tasks = { done: done.length, open: open.length, perDay: perDay, created: S.tasks.filter((t) => t.created && inR(keyOf(t.created), p)).length,
      best: perDay[best] ? days[best] : null, rate: done.length + open.length ? Math.round(done.length / (done.length + open.length) * 100) : null };

    const mon = S.money.filter((m) => inR(keyOf(m.t), p));
    const exp = mon.filter((m) => m.kind === 'exp'), cat = {};
    exp.forEach((m) => { const c = m.cat || L.moneyCat(m.text); cat[c] = (cat[c] || 0) + m.amount; });
    r.money = { exp: exp.reduce((a, m) => a + m.amount, 0), inc: mon.filter((m) => m.kind === 'inc').reduce((a, m) => a + m.amount, 0),
      perDay: days.map((k) => exp.filter((m) => keyOf(m.t) === k).reduce((a, m) => a + m.amount, 0)),
      cats: Object.keys(cat).sort((x, y) => cat[y] - cat[x]).slice(0, 3).map((c) => [c, cat[c]]) };

    const fl = S.focus.log.filter((x) => inR(keyOf(x.t), p));
    r.focus = { min: fl.reduce((a, x) => a + x.min, 0), n: fl.length };

    const hab = S.habits.map((x) => [x.name, days.filter((k) => x.days[k]).length]);
    const hs = hab.reduce((a, x) => a + x[1], 0);
    r.habits = { list: hab, pct: hab.length ? Math.round(hs / (hab.length * 7) * 100) : null };

    const meals = S.meals.filter((m) => inR(keyOf(m.t), p));
    const mealDays = days.filter((k) => meals.some((m) => keyOf(m.t) === k)).length;
    const water = days.map((k) => S.water[k] || 0);
    r.food = { kcal: mealDays ? Math.round(meals.reduce((a, m) => a + m.kcal, 0) / mealDays) : null, meals: meals.length,
      water: Math.round(water.reduce((a, x) => a + x, 0) / 7), goalDays: water.filter((x) => x >= S.goals.water).length };

    r.notes = S.notes.filter((n) => inR(keyOf(n.t), p)).length;
    return r;
  }

  const delta = (now, was) => {
    if (!was && !now) return '';
    if (!was) return 'раньше было 0';
    const v = Math.round((now - was) / was * 100);
    return (v > 0 ? '↑ ' : v < 0 ? '↓ ' : '') + Math.abs(v) + '% к прошлой неделе';
  };

  /* ---------- страница ---------- */

  let offset = 0;
  function pWeek() {
    const c = cfg(), S = D.S, root = h('div', { class: 'stack' });
    const p = period(offset), prev = period(offset + 1), r = calc(p), q = calc(prev);
    if (offset === 0) { S.settings.weekSeen = p.b; save(); }

    root.append(h('div', { class: 'wk-nav' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'неделя раньше', onclick: () => { offset++; refresh(); } }, h('span', { class: 'flip' }, icon('right'))),
      h('div', { style: 'text-align:center' }, label(offset === 0 ? 'последний итог' : offset + ' ' + plural(offset, 'неделя', 'недели', 'недель') + ' назад'), h('p', { class: 'lead', style: 'margin:4px 0 0', text: dm(p.a) + ' – ' + dm(p.b) })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'неделя позже', disabled: offset === 0 ? '' : null, style: offset === 0 ? 'opacity:.3' : '', onclick: () => { if (offset > 0) { offset--; refresh(); } } }, icon('right'))));

    const bars = (vals, k, unit) => {
      const mx = Math.max(1, ...vals);
      return h('div', { class: 'week7' }, vals.map((v, i) => h('div', { class: 'col' + (i === 6 ? ' now' : '') },
        h('div', { class: 'bar7', style: 'height:' + (v ? Math.max(6, v / mx * 100) : 0) + '%', title: v + (unit || '') }), h('small', { text: L.WD_SHORT[L.fromKey(r.days[i]).getDay()] }))));
    };

    if (c.parts.tasks) {
      root.append(card('dots', label('задачи'),
        h('p', { class: 'num' }, String(r.tasks.done), h('small', { text: plural(r.tasks.done, 'выполнена', 'выполнено', 'выполнено') })),
        h('p', { class: 'cap', text: (delta(r.tasks.done, q.tasks.done) || 'Пока пусто.') + (r.tasks.open ? ' · не закрыто: ' + r.tasks.open : '') }),
        bars(r.tasks.perDay),
        r.tasks.best ? h('p', { class: 'cap', style: 'margin-top:12px', text: 'Самый продуктивный день: ' + D.dateLabel(r.tasks.best) + '.' }) : null));
    }
    const grid = h('div', { class: 'grid' });
    if (c.parts.money) {
      root.append(card('', label('деньги'),
        h('div', { class: 'tile-head', style: 'align-items:flex-end' },
          h('div', null, h('p', { class: 'num sm' }, fmt(r.money.exp), h('small', { text: '₸ расходов' })), h('p', { class: 'cap', text: delta(r.money.exp, q.money.exp) || 'Трат не было.' })),
          r.money.inc ? h('div', { style: 'text-align:right' }, h('p', { class: 'num xs', style: 'margin:0' }, '+' + fmt(r.money.inc)), label('доход')) : null),
        bars(r.money.perDay, 0, ' ₸'),
        r.money.cats.length ? h('div', { style: 'margin-top:14px' }, r.money.cats.map((x) => h('div', { class: 'kv' }, h('span', { text: x[0] }), h('b', { text: fmt(x[1]) + ' ₸' })))) : null));
    }
    if (c.parts.focus) grid.append(card('', label('фокус'), h('p', { class: 'num sm' }, String(r.focus.min), h('small', { text: 'мин' })), h('p', { class: 'cap', text: r.focus.n + ' ' + plural(r.focus.n, 'сессия', 'сессии', 'сессий') + (q.focus.min ? ' · ' + (delta(r.focus.min, q.focus.min)).replace(' к прошлой неделе', '') : '') })));
    if (c.parts.notes) grid.append(card('', label('заметки'), h('p', { class: 'num sm' }, String(r.notes)), h('p', { class: 'cap', text: 'новых за неделю' })));
    if (grid.children.length) root.append(grid);

    if (c.parts.habits) {
      root.append(card('', label('привычки'),
        r.habits.pct == null ? h('p', { class: 'cap', text: 'Привычек пока нет.' }) : h('div', null,
          h('p', { class: 'num sm' }, r.habits.pct + '%', h('small', { text: 'выполнено' })),
          h('div', { style: 'margin-top:10px' }, r.habits.list.map((x) => h('div', { class: 'kv' }, h('span', { text: x[0] }), h('b', { text: x[1] + ' из 7' })))))));
    }
    if (c.parts.food) {
      root.append(card('', label('еда и вода'),
        h('div', { class: 'kv' }, h('span', { text: 'калорий в день' }), h('b', { text: r.food.kcal == null ? 'нет записей' : r.food.kcal + ' ккал' })),
        h('div', { class: 'kv' }, h('span', { text: 'воды в день' }), h('b', { text: r.food.water + ' мл' })),
        h('div', { class: 'kv' }, h('span', { text: 'дней с целью по воде' }), h('b', { text: r.food.goalDays + ' из 7' }))));
    }

    root.append(settingsCard());
    return root;
  }

  function settingsCard() {
    const c = cfg();
    const hours = []; for (let i = 0; i <= 23; i++) hours.push(i);
    const sel = h('select', { class: 'select', 'aria-label': 'время итога', value: String(c.hour), onchange: (e) => { c.hour = Number(e.target.value); save(); toast('итог будет в ' + c.hour + ':00'); refresh(); } },
      hours.map((x) => h('option', { value: String(x), text: x + ':00' })));
    const box = card('', label('когда показывать итог'),
      h('p', { class: 'cap', text: c.on ? 'Итог придёт в ' + DAY_FULL[c.day] + ' в ' + c.hour + ':00 карточкой на главной' + (c.notify ? ' и уведомлением' : '') + '.' : 'Итог недели выключен. Страница останется в разделе «Ещё».' }),
      h('div', { class: 'form', style: 'margin-top:12px' },
        chips([[1, 'вкл'], [0, 'выкл']], c.on ? 1 : 0, (k) => { c.on = !!k; save(); refresh(); }),
        c.on ? h('div', { class: 'form' },
          label('день'),
          chips(DAYS, c.day, (k) => { c.day = k; save(); refresh(); }),
          label('время'), sel,
          label('что считать'),
          h('div', { class: 'chips' }, PARTS.map((x) => h('button', { class: 'chip' + (c.parts[x[0]] ? ' on' : ''), type: 'button', 'aria-pressed': c.parts[x[0]] ? 'true' : 'false', text: x[1],
            onclick: () => { const on = Object.keys(c.parts).filter((k) => c.parts[k]); if (c.parts[x[0]] && on.length === 1) { toast('оставь хотя бы один раздел'); return; } c.parts[x[0]] = !c.parts[x[0]]; save(); refresh(); } }))),
          label('уведомление'),
          chips([[1, 'присылать'], [0, 'без уведомления']], c.notify ? 1 : 0, (k) => { c.notify = !!k; save(); refresh(); })) : null));
    return box;
  }

  /* ---------- карточка на главной и уведомление ---------- */

  function fresh() {
    const c = cfg(); if (!c.on) return null;
    const p = period(0);
    if (D.S.settings.weekSeen === p.b) return null;
    if (Date.now() - lastReport(Date.now()).getTime() > 3 * 86400000) return null;   // не навязываем старый итог
    if (!D.S.tasks.length && !D.S.money.length && !D.S.habits.length) return null;
    return p;
  }

  D.weekCard = function () {
    const p = fresh(); if (!p) return null;
    const r = calc(p), c = cfg(), bits = [];
    if (c.parts.tasks) bits.push(r.tasks.done + ' ' + plural(r.tasks.done, 'задача', 'задачи', 'задач'));
    if (c.parts.money && r.money.exp) bits.push(fmt(r.money.exp) + ' ₸ расходов');
    if (c.parts.focus && r.focus.min) bits.push(r.focus.min + ' мин фокуса');
    return tapCard('span2 dots', () => go('week'), label('итог недели · ' + dm(p.a) + ' – ' + dm(p.b)),
      h('p', { class: 'lead', text: bits.join(' · ') || 'Неделя готова' }),
      h('p', { class: 'cap', text: 'Открой итог и посмотри, как прошла неделя.' }));
  };

  function tick() {
    const c = cfg(); if (!c.on || !c.notify) return;
    const rep = lastReport(Date.now()), key = L.dkey(rep), p = period(0);
    if (D.S.settings.weekNotified === key || D.S.settings.weekSeen === p.b) return;
    if (Date.now() - rep.getTime() > 6 * 3600000) { D.S.settings.weekNotified = key; save(); return; }   // приложение открыли поздно, пуш уже не нужен
    D.S.settings.weekNotified = key; save();
    const r = calc(p);
    if (D.notify) D.notify('Итог недели', r.tasks.done + ' ' + plural(r.tasks.done, 'задача', 'задачи', 'задач') + ' выполнено. Открой, чтобы посмотреть всю неделю.', 'week');
    if (D.render) D.render(false);
  }
  setInterval(tick, 30000); setTimeout(tick, 4000);

  /* ---------- тема в настройках ---------- */

  D.themeCard = function () {
    const T = window.DDXTheme;
    return card('', label('тема'),
      h('p', { class: 'cap', text: 'Авто следует настройке телефона. Переключение плавное.' }),
      h('div', { style: 'margin-top:12px' }, chips([['auto', 'авто'], ['light', 'светлая'], ['dark', 'тёмная']], T.mode(), (m) => T.set(m, true))));
  };

  D.page('week', 'Итог недели', pWeek, 'digest');
})();
