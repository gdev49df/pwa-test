/* пять главных разделов: главная, задачи, заметки, еда, деньги */
(function () {
  'use strict';
  const D = window.DDX, L = D.L, C = D.C;
  const { h, icon, card, tapCard, label, empty, section, chips, today, tomorrow, fmt, plural, hm, go, save, toast, refresh } = D;

  /* ================= главная ================= */

  function pDigest() {
    const S = D.S, t0 = today(), now = new Date();
    const root = h('div', { class: 'grid' });
    const st = L.dayStats(S.tasks, t0);

    // приветствие и прогресс дня
    const fill = h('div', { class: 'fill' });
    const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'меню', onclick: () => go('menu') }, icon('menu'));
    root.append(card('span2 hello dots',
      label(D.WEEKDAYS[now.getDay()]),
      h('p', { class: 'date', text: now.getDate() + ' ' + D.MONTHS[now.getMonth()] }),
      h('p', { class: 'greet', text: L.greeting(now) + (S.name ? ', ' + S.name : '') }),
      h('div', { class: 'line', style: 'margin-top:16px;gap:12px' },
        h('div', { class: 'track', style: 'flex:1;margin:0' }, fill),
        h('span', { class: 'when', text: st.total ? 'день ' + st.pct + '%' : 'день свободен' })),
      menuBtn
    ));
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = st.pct + '%'; }));

    // последняя запись
    if (S.last && Date.now() - S.last.t < 3 * 86400000) {
      root.append(card('span2 last', h('span', { class: 'bullet', 'aria-hidden': 'true' }),
        h('div', { class: 'body' },
          h('div', { class: 'tile-head' }, label(S.last.type), h('span', { class: 'when', text: D.ago(S.last.t) })),
          h('p', { class: 't', text: S.last.text }))));
    }

    // задачи
    const act = D.activeTasks().filter((t) => t.kind !== 'meeting');
    root.append(tapCard('tile', () => go('tasks'),
      label('задачи'),
      h('p', { class: 'num', text: String(act.length) }),
      h('p', { class: 'cap', text: act.length ? plural(act.length, 'активная', 'активных', 'активных') + (st.open ? ', сегодня ' + st.open : '') : 'задач нет' })));

    // заметки
    const notes = S.notes.filter((n) => !n.archived);
    root.append(tapCard('tile', () => go('notes'),
      label('заметки'),
      notes.length ? h('p', { class: 'num', text: String(notes.length) }) : h('span', { class: 'plus' }, icon('plus')),
      h('p', { class: 'cap clamp', style: '-webkit-line-clamp:1', text: notes.length ? notes[0].text : 'мысль или запись' })));

    // встречи
    const meet = D.activeTasks().filter((t) => t.kind === 'meeting' && t.due && t.due >= t0).sort((a, b) => D.dueTs(a) - D.dueTs(b))[0];
    root.append(tapCard('tile', () => (meet ? D.taskSheet(meet) : D.taskSheet(null, { kind: 'meeting', due: t0 })),
      label('встречи'),
      meet ? h('p', { class: 'lead clamp', style: '-webkit-line-clamp:2', text: meet.title }) : h('span', { class: 'plus' }, icon('plus')),
      h('p', { class: 'cap', text: meet ? D.dueLabel(meet.due, meet.time) : 'запланировать встречу' })));

    // еда и вода
    const kcal = S.meals.filter((m) => L.dkey(new Date(m.t)) === t0).reduce((a, m) => a + m.kcal, 0);
    const water = S.water[t0] || 0;
    const wfill = h('div', { class: 'fill' });
    root.append(tapCard('tile', () => go('food'),
      label('еда'),
      kcal ? h('p', { class: 'num sm' }, fmt(kcal), h('small', { text: 'ккал' })) : h('p', { class: 'lead', text: 'Запиши, что съел' }),
      h('div', null, h('div', { class: 'track' }, wfill), h('p', { class: 'cap', style: 'font-size:12px', text: fmt(water) + ' / ' + fmt(S.goals.water) + ' мл' }))));
    requestAnimationFrame(() => requestAnimationFrame(() => { wfill.style.width = Math.min(100, water / S.goals.water * 100) + '%'; }));

    // деньги
    const month = D.monthMoney();
    const spentMonth = month.filter((m) => m.kind === 'exp').reduce((a, m) => a + m.amount, 0);
    const spentToday = month.filter((m) => m.kind === 'exp' && L.dkey(new Date(m.t)) === t0).reduce((a, m) => a + m.amount, 0);
    if (S.budget > 0) {
      const bfill = h('div', { class: 'fill' + (spentMonth > S.budget ? ' over' : '') });
      root.append(tapCard('span2', () => go('money'),
        h('div', { class: 'tile-head' }, label('деньги'), h('span', { class: 'when', text: 'сегодня −' + fmt(spentToday) + ' ₸' })),
        h('p', { class: 'num sm' }, fmt(spentMonth), h('small', { text: '₸ из ' + fmt(S.budget) })),
        h('div', { class: 'track' }, bfill),
        h('p', { class: 'cap', text: spentMonth <= S.budget ? 'осталось ' + fmt(S.budget - spentMonth) + ' ₸ на месяц' : 'бюджет превышен на ' + fmt(spentMonth - S.budget) + ' ₸' })));
      requestAnimationFrame(() => requestAnimationFrame(() => { bfill.style.width = Math.min(100, spentMonth / S.budget * 100) + '%'; }));
    } else {
      root.append(tapCard('span2', () => go('money'),
        h('div', { class: 'tile-head' }, label('деньги'), spentToday ? h('span', { class: 'when', text: 'сегодня −' + fmt(spentToday) + ' ₸' }) : null),
        h('p', { class: 'lead', text: 'Настрой бюджет →' }),
        month.length ? h('p', { class: 'cap', text: 'за месяц потрачено ' + fmt(spentMonth) + ' ₸' }) : null));
    }

    // вечерний сброс
    const pending = S.tasks.filter((t) => !t.done && t.due && t.due <= t0);
    if (now.getHours() >= S.settings.resetHour && pending.length) {
      root.append(card('span2 dots',
        label('daily reset'),
        h('p', { class: 'lead', text: pending.length + ' ' + plural(pending.length, 'задача не выполнена', 'задачи не выполнены', 'задач не выполнено') }),
        h('p', { class: 'cap', text: 'Перенеси на завтра, выбери другую дату или удали.' }),
        h('div', { class: 'line', style: 'margin-top:12px' },
          h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: 'всё на завтра', onclick: () => {
            const was = pending.map((t) => [t, t.due]);
            pending.forEach((t) => { t.due = tomorrow(); t.fired = false; }); save();
            toast('перенесено на завтра', () => { was.forEach((w) => { w[0].due = w[1]; }); save(); refresh(); });
            refresh();
          } }),
          h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'разобрать', onclick: () => go('reset') }))));
    } else if (pending.length) {
      // на сегодня
      const list = card('span2', h('div', { class: 'tile-head' }, label('на сегодня'), h('span', { class: 'when', text: st.done + ' из ' + st.total })));
      pending.sort(D.TASK_SORT).slice(0, 4).forEach((t) => list.append(h('div', { class: 'item', style: 'margin-top:12px' },
        h('button', { class: 'check' + (t.pri ? ' p' + t.pri : ''), type: 'button', 'aria-label': 'выполнить: ' + t.title, onclick: () => { D.toggleTask(t); refresh(); } }),
        h('div', { class: 'item-body tap', onclick: () => D.taskSheet(t) }, h('p', { class: 'item-title', text: t.title }), h('p', { class: 'item-meta', text: D.dueLabel(t.due, t.time) })))));
      if (pending.length > 4) list.append(h('button', { class: 'link', style: 'margin:6px 0 -8px -10px', type: 'button', text: 'ещё ' + (pending.length - 4), onclick: () => go('tasks') }));
      root.append(list);
    }

    // привычки
    const hab = S.habits;
    const hdone = hab.filter((x) => x.days[t0]).length;
    root.append(tapCard('tile', () => go('habits'),
      label('привычки'),
      hab.length ? h('p', { class: 'num sm' }, hdone + '/' + hab.length) : h('span', { class: 'plus' }, icon('plus')),
      h('p', { class: 'cap', text: hab.length ? (hdone === hab.length ? 'все отмечены' : 'отмечено сегодня') : 'трекер привычек' })));

    // focus mode
    const f = S.focus.active;
    const ftask = f && S.tasks.find((x) => x.id === f.taskId);
    root.append(tapCard('tile', () => go('focus'),
      label('focus mode'),
      f ? h('p', { class: 'num sm', 'data-focus-clock': '1', text: clock(D.focusLeft()) }) : h('p', { class: 'num sm' }, '25', h('small', { text: 'мин' })),
      h('p', { class: 'cap clamp', style: '-webkit-line-clamp:1', text: f ? (f.paused != null ? 'пауза' : (ftask ? ftask.title : 'идёт фокус')) : 'начать концентрацию' })));

    // закреплённые заметки
    const pins = notes.filter((n) => n.pin).slice(0, 3);
    if (pins.length) {
      const pc = card('span2 dots', label('закреплено'));
      pins.forEach((n) => pc.append(h('p', { class: 'item-text clamp tap', style: 'margin-top:10px;font-size:15.5px', text: n.text, onclick: () => go('notes') })));
      root.append(pc);
    }

    // календарь: ближайшие 7 дней
    const strip = h('div', { class: 'week-strip' });
    for (let i = 0; i < 7; i++) {
      const d = L.addDays(now, i), k = L.dkey(d);
      const n = S.tasks.filter((t) => !t.done && t.due === k).length;
      strip.append(h('button', { class: 'day' + (i === 0 ? ' today' : ''), type: 'button', 'aria-label': D.dateLabel(k) + ', ' + n + ' ' + plural(n, 'дело', 'дела', 'дел'), onclick: (e) => { e.stopPropagation(); go('calendar', k); } },
        h('small', { text: L.WD_SHORT[d.getDay()] }), String(d.getDate()),
        n ? h('span', { class: 'marks' }, Array.from({ length: Math.min(3, n) }, () => h('i'))) : null));
    }
    root.append(tapCard('span2', () => go('calendar'), h('div', { class: 'tile-head' }, label('календарь'), h('span', { class: 'when', text: D.MONTHS_NOM[now.getMonth()] })), strip));

    // остальные разделы
    const lists = S.lists, open = lists.reduce((a, l) => a + l.items.filter((x) => !x.done).length, 0);
    root.append(
      tapCard('tile', () => go('lists'), label('умные списки'),
        lists.length ? h('p', { class: 'num sm', text: String(open) }) : h('span', { class: 'plus' }, icon('plus')),
        h('p', { class: 'cap', text: lists.length ? 'пунктов в ' + lists.length + ' ' + plural(lists.length, 'списке', 'списках', 'списках') : 'покупки, книги, фильмы' })),
      tapCard('tile', () => go('stats'), label('статистика'),
        h('p', { class: 'num sm', text: String(S.tasks.filter((t) => t.done && t.doneAt > Date.now() - 7 * 86400000).length) }),
        h('p', { class: 'cap', text: 'задач за 7 дней' })),
      tapCard('tile', () => go('timeline'), label('timeline'), h('p', { class: 'lead', text: 'Лента дня' }), h('p', { class: 'cap', text: 'всё, что было, по порядку' })),
      tapCard('tile', () => go('search'), label('поиск'), h('span', { class: 'plus' }, icon('search')), h('p', { class: 'cap', text: 'заметки, задачи, списки' }))
    );

    if (!D.isPro()) {
      root.append(tapCard('span2', () => go('pro'),
        h('div', { class: 'tile-head' }, label('ddx pro'), h('span', { class: 'when', text: fmt(C.price.month) + ' ₸ / мес' })),
        h('p', { class: 'lead', text: 'Сними все ограничения' }),
        h('p', { class: 'cap', text: 'Безлимит на голос, задачи, заметки, списки и статистику.' })));
    }
    return root;
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + D.pad(s % 60);
  }
  D.clock = clock;

  /* ================= задачи ================= */

  D.TASK_SORT = (a, b) => (String(a.due || '9') .localeCompare(String(b.due || '9'))) || (String(a.time || '99').localeCompare(String(b.time || '99'))) || (b.pri - a.pri) || (b.created - a.created);

  let taskFilter = 'active';

  function pTasks() {
    const S = D.S, root = h('div', { class: 'stack' }), t0 = today();

    // умный ввод: «позвонить маме завтра в 10», «отчёт каждый второй понедельник»
    const input = h('input', { class: 'field', placeholder: 'новая задача', maxlength: '140', enterkeyhint: 'done', 'aria-label': 'новая задача' });
    const hint = h('p', { class: 'cap', style: 'margin:8px 2px 0;min-height:19px' });
    const parse = () => {
      const v = input.value.trim();
      if (!v) { hint.textContent = 'можно сразу с датой: «отчёт в пятницу в 10», «зарядка по будням»'; return null; }
      const p = L.parseCapture(v, new Date());
      const isT = p.type === 'task' || p.type === 'meeting';
      const bits = [];
      if (isT && p.type === 'meeting') bits.push('встреча');
      if (isT && p.due) bits.push(D.dueLabel(p.due, p.time));
      if (isT && p.repeat) bits.push(L.repeatLabel(p.repeat));
      if (isT && p.remind) bits.push('с напоминанием');
      hint.textContent = bits.length ? '→ ' + bits.join(', ') : 'без срока';
      return isT ? p : { type: 'task', text: L.cap(v) };
    };
    input.addEventListener('input', parse);
    const add = () => {
      const p = parse();
      if (!p) { input.focus(); return; }
      const t = D.addTask({ title: p.text || L.cap(input.value.trim()), kind: p.type === 'meeting' ? 'meeting' : 'task', due: p.due, time: p.time, pri: p.pri, repeat: p.repeat, remind: p.remind });
      if (t) { toast(t.due ? 'добавлено на ' + D.dueLabel(t.due, t.time) : 'задача добавлена'); refresh(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    parse();
    root.append(card('',
      h('div', { class: 'line' }, input, h('button', { class: 'btn solid', type: 'button', 'aria-label': 'добавить задачу', onclick: add }, icon('plus'))),
      hint,
      h('div', { class: 'links' },
        h('button', { class: 'link', type: 'button', text: 'подробнее', onclick: () => D.taskSheet(null, { title: input.value.trim() }) }),
        h('button', { class: 'link', type: 'button', text: 'встреча', onclick: () => D.taskSheet(null, { kind: 'meeting', due: t0 }) }),
        h('button', { class: 'link', type: 'button', text: 'календарь', onclick: () => go('calendar') }),
        h('button', { class: 'link', type: 'button', text: 'сброс дня', onclick: () => go('reset') }))));

    const act = D.activeTasks();
    const ll = D.limitLine('активных задач', act.length, 'tasks');
    if (ll) root.append(ll);

    root.append(chips([['active', 'все'], ['today', 'сегодня'], ['meet', 'встречи'], ['repeat', 'повторы'], ['remind', 'напоминания'], ['done', 'выполнено']], taskFilter, (k) => { taskFilter = k; refresh(); }, 'scroll'));

    const week = L.dkey(L.addDays(new Date(), 7));
    let groups;
    if (taskFilter === 'done') {
      const done = S.tasks.filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 60);
      groups = [['сегодня', done.filter((t) => t.doneKey === t0)], ['раньше', done.filter((t) => t.doneKey !== t0)]];
    } else {
      let list = act.slice().sort(D.TASK_SORT);
      if (taskFilter === 'today') list = list.filter((t) => t.due && t.due <= t0);
      if (taskFilter === 'meet') list = list.filter((t) => t.kind === 'meeting');
      if (taskFilter === 'repeat') list = list.filter((t) => t.repeat);
      if (taskFilter === 'remind') list = list.filter((t) => t.remind);
      groups = [
        ['просрочено', list.filter((t) => t.due && t.due < t0)],
        ['сегодня', list.filter((t) => t.due === t0)],
        ['завтра', list.filter((t) => t.due === tomorrow())],
        ['на неделе', list.filter((t) => t.due && t.due > tomorrow() && t.due <= week)],
        ['позже', list.filter((t) => t.due && t.due > week)],
        ['без срока', list.filter((t) => !t.due)]
      ];
      if (taskFilter === 'active') groups.push(['выполнено сегодня', S.tasks.filter((t) => t.done && t.doneKey === t0)]);
    }
    let any = false;
    groups.forEach((g) => {
      if (!g[1].length) return;
      any = true;
      root.append(section(g[0], h('span', { class: 'when', text: String(g[1].length) })), card('', g[1].map(taskItem)));
    });
    if (!any) {
      root.append(empty(taskFilter === 'active' ? 'задач пока нет' : 'здесь пусто',
        taskFilter === 'active' ? 'Напиши выше или нажми на микрофон и скажи: «напомни завтра в 9 утра позвонить врачу».' : 'Попробуй другой фильтр.'));
    } else if (taskFilter !== 'done') {
      root.append(label('свайп влево: на завтра, вправо: готово', 'tiny'));
    }
    return root;
  }

  function taskMeta(t) {
    const meta = h('p', { class: 'item-meta' });
    if (t.kind === 'meeting') meta.append(h('span', { class: 'tag', text: 'встреча' }));
    if (t.pri === 2) meta.append(h('span', { class: 'tag hot', text: 'срочно' }));
    else if (t.pri === 1) meta.append(h('span', { class: 'tag', text: 'важно' }));
    const bits = [];
    if (t.done && t.doneAt) bits.push('выполнено ' + D.stampOf(t.doneAt));
    else if (t.due) bits.push(D.dueLabel(t.due, t.time));
    if (t.repeat) bits.push(L.repeatLabel(t.repeat));
    if (t.remind && !t.done) bits.push('напомнит');
    if (t.place) bits.push(t.place);
    if (t.subs.length) bits.push(t.subs.filter((s) => s.done).length + '/' + t.subs.length + ' подзадач');
    meta.append(bits.join(' · '));
    return meta;
  }

  function taskItem(t) {
    const row = h('div', { class: 'item' + (t.done ? ' done' : ''), style: 'touch-action:pan-y' },
      h('button', { class: 'check' + (t.done ? ' on' : '') + (t.pri && !t.done ? ' p' + t.pri : ''), type: 'button', 'aria-label': (t.done ? 'вернуть: ' : 'выполнить: ') + t.title, onclick: () => {
        D.toggleTask(t);
        if (t.done) toast(t.repeat ? 'готово, следующая: ' + D.dueLabel(L.nextDue(t.due || today(), t.repeat)) : 'готово', () => { D.toggleTask(t); refresh(); });
        refresh();
      } }),
      h('div', { class: 'item-body tap', role: 'button', tabindex: '0', onclick: () => D.taskSheet(t), onkeydown: (e) => { if (e.key === 'Enter') D.taskSheet(t); } },
        h('p', { class: 'item-title', text: t.title }), taskMeta(t)));
    if (!t.done) swipe(row, t);
    return row;
  }

  // свайп: влево перенос на завтра, вправо выполнено
  function swipe(row, t) {
    let x0 = 0, y0 = 0, dx = 0, on = false;
    row.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; on = true; row.style.transition = 'none'; }, { passive: true });
    row.addEventListener('touchmove', (e) => {
      if (!on) return;
      dx = e.touches[0].clientX - x0;
      if (Math.abs(e.touches[0].clientY - y0) > 24 && Math.abs(dx) < 30) { on = false; row.style.transform = ''; return; }
      row.style.transform = 'translateX(' + Math.max(-110, Math.min(110, dx)) + 'px)';
      row.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 260));
    }, { passive: true });
    row.addEventListener('touchend', () => {
      if (!on) return;
      on = false;
      row.style.transition = 'transform .35s var(--ease), opacity .35s';
      if (dx < -80) {
        const was = [t.due, t.fired];
        t.due = tomorrow(); t.fired = false; save();
        toast('перенесено на завтра', () => { t.due = was[0]; t.fired = was[1]; save(); refresh(); });
        refresh();
      } else if (dx > 80) {
        D.toggleTask(t); toast('готово', () => { D.toggleTask(t); refresh(); }); refresh();
      } else { row.style.transform = ''; row.style.opacity = ''; }
    });
  }

  /* лист задачи: создание и правка со всеми полями */
  const REPEAT_PRESETS = [
    ['', 'не повторять', null], ['d1', 'каждый день', { k: 'days', n: 1 }], ['wd', 'по будням', { k: 'weeks', n: 1, wd: [1, 2, 3, 4, 5] }],
    ['w1', 'каждую неделю', { k: 'weeks', n: 1, wd: [] }], ['w2', 'каждые 2 недели', { k: 'weeks', n: 2, wd: [] }],
    ['m1', 'каждый месяц', { k: 'months', n: 1, day: 0 }], ['custom', 'свой вариант…', null]
  ];
  function presetOf(rule) {
    if (!rule) return '';
    const s = JSON.stringify(rule);
    const p = REPEAT_PRESETS.find((x) => x[2] && JSON.stringify(x[2]) === s);
    return p ? p[0] : 'custom';
  }

  D.taskSheet = function (t, preset) {
    const isNew = !t;
    const src = t || Object.assign({ title: '', kind: 'task', due: '', time: '', pri: 0, repeat: null, remind: false, place: '', subs: [] }, preset || {});
    const st = {
      title: src.title, kind: src.kind || 'task', due: src.due || '', time: src.time || '', pri: src.pri || 0,
      repeat: L.normRule(src.repeat), remind: !!src.remind, place: src.place || '', subs: (src.subs || []).map((s) => (typeof s === 'string' ? { t: s, done: false } : Object.assign({}, s)))
    };
    let rp = presetOf(st.repeat), customText = rp === 'custom' ? L.repeatLabel(st.repeat) : '';

    D.openSheet((panel) => {
      const draw = () => {
        panel.replaceChildren();
        const title = h('textarea', { class: 'area', rows: '2', maxlength: '200', placeholder: st.kind === 'meeting' ? 'с кем и о чём' : 'что нужно сделать', value: st.title, 'aria-label': 'название', oninput: (e) => { st.title = e.target.value; } });
        const due = h('input', { class: 'field', type: 'date', value: st.due, 'aria-label': 'дата', onchange: (e) => { st.due = e.target.value; } });
        const time = h('input', { class: 'field', type: 'time', value: st.time, 'aria-label': 'время', style: 'max-width:120px', onchange: (e) => { st.time = e.target.value; } });
        const rsel = h('select', { class: 'select', 'aria-label': 'повтор', value: rp, onchange: (e) => {
          rp = e.target.value;
          const p = REPEAT_PRESETS.find((x) => x[0] === rp);
          if (rp !== 'custom') st.repeat = p[2] ? JSON.parse(JSON.stringify(p[2])) : null;
          draw();
        } }, REPEAT_PRESETS.map((p) => h('option', { value: p[0], text: p[1] })));
        const rhint = h('p', { class: 'cap', style: 'margin:0 2px' });
        const custom = rp === 'custom' ? h('input', { class: 'field', placeholder: 'каждые 3 дня, каждый второй понедельник, 1 числа каждого месяца', value: customText, 'aria-label': 'свой повтор',
          oninput: (e) => { customText = e.target.value; const r = L.parseRepeat(customText).rule; st.repeat = r; rhint.textContent = r ? '→ ' + L.repeatLabel(r) : 'не понял, попробуй иначе'; } }) : null;
        if (rp === 'custom') rhint.textContent = st.repeat ? '→ ' + L.repeatLabel(st.repeat) : 'например: «по вторникам и четвергам»';

        const subBox = h('div', { class: 'sub' });
        const drawSubs = () => {
          subBox.replaceChildren();
          st.subs.forEach((s, i) => subBox.append(h('div', { class: 'sub-row' + (s.done ? ' done' : '') },
            h('button', { class: 'check sq' + (s.done ? ' on' : ''), type: 'button', 'aria-label': 'подзадача: ' + s.t, onclick: () => { s.done = !s.done; drawSubs(); } }),
            h('span', { text: s.t, style: 'flex:1' }),
            h('button', { class: 'link', type: 'button', 'aria-label': 'убрать подзадачу', onclick: () => { st.subs.splice(i, 1); drawSubs(); } }, '×'))));
        };
        drawSubs();
        const subIn = h('input', { class: 'field', placeholder: 'подзадача', maxlength: '100', enterkeyhint: 'done', 'aria-label': 'новая подзадача' });
        const addSub = () => {
          const v = subIn.value.trim();
          if (!v) return;
          if (st.subs.length >= D.lim('subs')) return D.limitHit('subs');
          st.subs.push({ t: L.cap(v), done: false }); subIn.value = ''; drawSubs(); subIn.focus();
        };
        subIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });

        const remindChip = h('button', { class: 'chip' + (st.remind ? ' on' : ''), type: 'button', 'aria-pressed': st.remind ? 'true' : 'false', text: st.remind ? 'напомню' : 'напомнить', onclick: () => {
          st.remind = !st.remind;
          if (st.remind && !st.due) st.due = today();
          if (st.remind && !st.time) { const n = new Date(Date.now() + 3600000); st.time = D.pad(n.getHours()) + ':00'; }
          draw();
        } });

        const commit = () => {
          const name = L.cap(st.title.trim().replace(/\s+/g, ' '));
          if (!name) { title.focus(); return; }
          if (rp === 'custom' && !st.repeat) { toast('не понял повтор'); return; }
          if (isNew) {
            const nt = D.addTask({ title: name, kind: st.kind, due: st.due, time: st.time, pri: st.pri, repeat: st.repeat, remind: st.remind, place: st.place, subs: [] });
            if (!nt) return;
            nt.subs = st.subs;
            save();
            D.closeSheet(); toast(st.kind === 'meeting' ? 'встреча добавлена' : 'задача добавлена'); refresh();
            return;
          }
          const act = D.activeTasks();
          if (st.repeat && !t.repeat && act.filter((x) => x.repeat).length >= D.lim('repeats')) return D.limitHit('repeats');
          if (st.remind && !t.remind && D.activeReminders().length >= D.lim('reminders')) return D.limitHit('reminders');
          if (st.subs.length > D.lim('subs')) return D.limitHit('subs');
          if (st.due !== t.due || st.time !== (t.time || '') || st.remind !== t.remind) t.fired = false;
          Object.assign(t, { title: name, kind: st.kind, due: st.due || (st.repeat ? L.firstDue(st.repeat, today()) : null), time: st.time || null, pri: st.pri, repeat: st.repeat, remind: st.remind && !!st.due, place: st.place, subs: st.subs });
          save(); D.closeSheet(); toast('сохранено'); refresh();
        };

        panel.append(
          h('h2', { text: isNew ? (st.kind === 'meeting' ? 'новая встреча' : 'новая задача') : (t.done ? 'выполнено' : st.kind === 'meeting' ? 'встреча' : 'задача') }),
          h('div', { class: 'form' },
            chips([['task', 'задача'], ['meeting', 'встреча']], st.kind, (k) => { st.kind = k; draw(); }),
            title,
            st.kind === 'meeting' ? h('input', { class: 'field', placeholder: 'где: адрес, ссылка на звонок', value: st.place, maxlength: '120', 'aria-label': 'место', oninput: (e) => { st.place = e.target.value; } }) : null,
            h('div', { class: 'line' }, due, time),
            h('div', { class: 'chips' },
              h('button', { class: 'chip', type: 'button', text: 'сегодня', onclick: () => { st.due = today(); draw(); } }),
              h('button', { class: 'chip', type: 'button', text: 'завтра', onclick: () => { st.due = tomorrow(); draw(); } }),
              h('button', { class: 'chip', type: 'button', text: 'без даты', onclick: () => { st.due = ''; st.time = ''; st.remind = false; draw(); } }),
              remindChip),
            rsel, custom, rp === 'custom' ? rhint : null,
            label('приоритет', 'tiny'),
            chips(D.PRI_LABEL.map((l, i) => [i, l]), st.pri, (k) => { st.pri = k; }),
            label('подзадачи', 'tiny'), subBox,
            h('div', { class: 'line' }, subIn, h('button', { class: 'btn', type: 'button', 'aria-label': 'добавить подзадачу', onclick: addSub }, icon('plus'))),
            h('button', { class: 'btn solid block', type: 'button', text: isNew ? 'добавить' : 'сохранить', onclick: commit }),
            !isNew ? h('div', { class: 'line' },
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'в календарь iphone', disabled: !st.due, onclick: () => D.downloadIcs(Object.assign({}, t, { title: L.cap(st.title.trim()) || t.title, due: st.due, time: st.time, repeat: st.repeat, place: st.place, kind: st.kind })) }),
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'фокус', onclick: () => { D.closeSheet(); go('focus', t.id); } })) : null,
            !isNew ? h('div', { class: 'line' },
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: t.done ? 'вернуть' : 'готово', onclick: () => { D.toggleTask(t); D.closeSheet(); refresh(); } }),
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'удалить', onclick: () => {
                const i = D.S.tasks.indexOf(t);
                D.S.tasks.splice(i, 1); save(); D.closeSheet();
                toast('удалено', () => { D.S.tasks.splice(i, 0, t); save(); refresh(); }); refresh();
              } })) : null
          )
        );
      };
      draw();
    });
  };

  /* ================= заметки ================= */

  let noteCat = '', noteQuery = '', editingNote = null;

  function pNotes() {
    const S = D.S, root = h('div', { class: 'stack' });
    const area = h('textarea', { class: 'area', rows: '3', placeholder: 'мысль, идея, запись', 'aria-label': 'текст заметки' });
    const sel = h('select', { class: 'select', 'aria-label': 'категория', value: noteCat },
      h('option', { value: '', text: 'без категории' }), S.cats.map((c) => h('option', { value: c, text: c })));
    const add = () => {
      const text = area.value.trim();
      if (!text) { area.focus(); return; }
      if (D.addNote(L.cap(text), sel.value)) { toast('заметка сохранена'); refresh(); }
    };
    root.append(card('', area,
      h('div', { class: 'line', style: 'margin-top:8px' }, sel, h('button', { class: 'btn solid', type: 'button', text: 'сохранить', onclick: add })),
      h('div', { class: 'links' },
        h('button', { class: 'link', type: 'button', text: 'категории', onclick: catSheet }),
        h('button', { class: 'link', type: 'button', text: 'умные списки', onclick: () => go('lists') }),
        h('button', { class: 'link', type: 'button', text: 'архив', onclick: () => go('archive') }))));

    const count = S.notes.filter((n) => !n.archived).length;
    const ll = D.limitLine('заметок', count, 'notes');
    if (ll) root.append(ll);

    const search = h('input', { class: 'field', type: 'search', placeholder: 'поиск по тексту, категории, дате', value: noteQuery, 'aria-label': 'поиск по заметкам' });
    const box = h('div', { class: 'stack' });
    search.addEventListener('input', () => { noteQuery = search.value; fillNotes(box); });
    root.append(search);
    if (S.cats.length) {
      root.append(chips([['', 'все']].concat(S.cats.map((c) => [c, c + ' ' + S.notes.filter((n) => !n.archived && n.cat === c).length])), noteCat, (k) => { noteCat = k; fillNotes(box); }, 'scroll'));
    }
    fillNotes(box);
    root.append(box);
    return root;
  }

  function fillNotes(box) {
    const S = D.S;
    box.replaceChildren();
    const q = noteQuery.trim().toLowerCase();
    const list = S.notes.filter((n) => !n.archived)
      .filter((n) => !noteCat || n.cat === noteCat)
      .filter((n) => {
        if (!q) return true;
        const d = new Date(n.t);
        const ds = D.pad(d.getDate()) + '.' + D.pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + d.getDate() + ' ' + D.MONTHS[d.getMonth()];
        return n.text.toLowerCase().includes(q) || (n.cat || '').toLowerCase().includes(q) || ds.includes(q);
      })
      .sort((a, b) => (b.pin - a.pin) || (b.t - a.t));
    if (!list.length) {
      box.append(empty(S.notes.length ? 'ничего не найдено' : 'заметок пока нет',
        S.notes.length ? 'Попробуй другое слово или сбрось категорию.' : 'Напиши выше или нажми на микрофон и просто говори. Скажи «запиши в категорию работа: …», и заметка сама попадёт в категорию.'));
      return;
    }
    list.forEach((n) => box.append(noteCard(n)));
  }

  function noteCard(n) {
    const S = D.S;
    const head = h('div', { class: 'tile-head' }, label(n.cat || 'заметка'), h('span', { class: 'when', text: (n.pin ? 'закреплено · ' : '') + D.stampOf(n.t) }));
    if (editingNote === n.id) {
      const ta = h('textarea', { class: 'area', rows: String(Math.min(10, Math.max(3, Math.ceil(n.text.length / 34)))), value: n.text, 'aria-label': 'текст заметки' });
      const sel = h('select', { class: 'select', 'aria-label': 'категория', value: n.cat }, h('option', { value: '', text: 'без категории' }), S.cats.map((c) => h('option', { value: c, text: c })));
      setTimeout(() => ta.focus(), 0);
      return card('', head, h('div', { class: 'form', style: 'margin-top:10px' }, ta, sel),
        h('div', { class: 'actions' },
          h('button', { class: 'link ink', type: 'button', text: 'сохранить', onclick: () => { const v = ta.value.trim(); if (v) { n.text = v; n.cat = sel.value; save(); } editingNote = null; refresh(); } }),
          h('button', { class: 'link', type: 'button', text: 'отмена', onclick: () => { editingNote = null; refresh(); } })));
    }
    return card(n.pin ? 'dots' : '', head,
      h('p', { class: 'item-text', style: 'margin-top:8px', text: n.text }),
      h('div', { class: 'actions' },
        h('button', { class: 'link', type: 'button', text: n.pin ? 'открепить' : 'закрепить', onclick: () => {
          if (!n.pin && S.notes.filter((x) => x.pin && !x.archived).length >= D.lim('pins')) return D.limitHit('pins');
          n.pin = !n.pin; save(); refresh();
        } }),
        h('button', { class: 'link', type: 'button', text: 'править', onclick: () => { editingNote = n.id; refresh(); } }),
        h('button', { class: 'link', type: 'button', text: 'в задачу', onclick: () => D.taskSheet(null, { title: n.text.slice(0, 200) }) }),
        h('button', { class: 'link', type: 'button', text: 'копировать', onclick: () => {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(n.text).then(() => toast('скопировано'), () => toast('не удалось скопировать'));
        } }),
        h('button', { class: 'link', type: 'button', text: 'в архив', onclick: () => {
          if (S.notes.filter((x) => x.archived).length + S.tasks.filter((x) => x.done).length >= D.lim('archive')) toast('архив полон: самые старые записи скрыты, pro хранит всё');
          n.archived = true; n.pin = false; n.archivedAt = Date.now(); save();
          toast('в архиве', () => { n.archived = false; save(); refresh(); }); refresh();
        } })));
  }

  function catSheet() {
    D.openSheet((p) => {
      const draw = () => {
        p.replaceChildren();
        const S = D.S;
        const input = h('input', { class: 'field', placeholder: 'работа, личное, идеи, покупки, учёба', maxlength: '30', enterkeyhint: 'done', 'aria-label': 'новая категория' });
        const add = () => { const n = D.addCat(input.value); if (n) { draw(); refresh(); } };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        p.append(h('h2', { text: 'категории' }),
          h('p', { class: 'cap', text: 'Скажи голосом «запиши в категорию работа: …», и заметка попадёт туда сама. Новая категория создастся автоматически.' }),
          h('div', { class: 'form' },
            h('div', { class: 'line' }, input, h('button', { class: 'btn solid', type: 'button', text: 'создать', onclick: add })),
            D.limitLine('категорий', S.cats.length, 'cats'),
            S.cats.length ? card('flat', S.cats.map((c) => h('div', { class: 'kv' },
              h('span', { text: c + '  ' }), h('span', null,
                h('span', { class: 'muted', text: S.notes.filter((n) => n.cat === c).length + '  ' }),
                h('button', { class: 'link', type: 'button', text: 'удалить', 'aria-label': 'удалить категорию ' + c, onclick: () => {
                  S.notes.forEach((n) => { if (n.cat === c) n.cat = ''; });
                  S.cats = S.cats.filter((x) => x !== c); if (noteCat === c) noteCat = ''; save(); draw(); refresh();
                } }))))) : null));
      };
      draw();
    });
  }

  /* ================= еда ================= */

  const QUICK_FOOD = ['плов 300 г', 'гречка с курицей', 'салат', 'суп', 'омлет', 'каша', 'шаурма', 'кофе с молоком', 'банан', 'йогурт'];
  let mealPhoto = null;

  function resizePhoto(file, cb) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 480, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.62));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('не удалось открыть фото'); };
    img.src = url;
  }

  function pFood() {
    const S = D.S, root = h('div', { class: 'stack' }), t0 = today();
    const meals = S.meals.filter((m) => L.dkey(new Date(m.t)) === t0);
    const total = meals.reduce((a, m) => a + m.kcal, 0);

    const kfill = h('div', { class: 'fill' + (total > S.goals.kcal ? ' over' : '') });
    root.append(card('dots',
      h('div', { class: 'tile-head' }, label('калории сегодня'), h('span', { class: 'when', text: 'цель ' + fmt(S.goals.kcal) })),
      h('p', { class: 'num' }, fmt(total), h('small', { text: 'ккал' })),
      h('div', { class: 'track' }, kfill),
      h('p', { class: 'cap', text: total <= S.goals.kcal ? 'осталось ' + fmt(S.goals.kcal - total) + ' ккал' : 'больше цели на ' + fmt(total - S.goals.kcal) + ' ккал' })));
    requestAnimationFrame(() => requestAnimationFrame(() => { kfill.style.width = Math.min(100, total / S.goals.kcal * 100) + '%'; }));

    // вода
    const w = S.water[t0] || 0, seg = 10, on = Math.min(seg, Math.floor(w / (S.goals.water / seg)));
    root.append(card('',
      h('div', { class: 'tile-head' }, label('вода'), h('span', { class: 'when', text: Math.round(w / S.goals.water * 100) + '%' })),
      h('p', { class: 'num sm' }, fmt(w), h('small', { text: '/ ' + fmt(S.goals.water) + ' мл' })),
      h('div', { class: 'drops', 'aria-hidden': 'true' }, Array.from({ length: seg }, (x, i) => h('i', { class: i < on ? 'on' : '' }))),
      h('div', { class: 'line', style: 'margin-top:12px' },
        h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: '+250 мл', onclick: () => { D.addWater(250); refresh(); } }),
        h('button', { class: 'btn', style: 'flex:1', type: 'button', text: '+500 мл', onclick: () => { D.addWater(500); refresh(); } }),
        h('button', { class: 'btn', type: 'button', text: '−250', 'aria-label': 'убрать 250 мл', onclick: () => { D.addWater(-250); refresh(); } }))));

    // добавить еду
    const text = h('input', { class: 'field', placeholder: 'что съел: плов 300 г', maxlength: '100', enterkeyhint: 'done', 'aria-label': 'что съел' });
    const kcal = h('input', { class: 'field', type: 'number', inputmode: 'numeric', placeholder: 'ккал', style: 'max-width:96px', 'aria-label': 'калории' });
    const est = h('p', { class: 'cap', style: 'margin:0 2px;min-height:19px' });
    let auto = 0;
    const estimate = () => {
      const e = L.estimateKcal(text.value);
      auto = e.kcal;
      kcal.placeholder = e.kcal ? String(e.kcal) : 'ккал';
      est.textContent = e.items.length ? '≈ ' + e.items.map((i) => i.name + ' ' + i.grams + ' г, ' + i.kcal).join(' + ') + ' ккал' : text.value.trim() ? 'не знаю это блюдо, впиши калории сам' : 'я посчитаю калории для привычных блюд';
    };
    text.addEventListener('input', estimate);
    const photoPrev = h('div');
    const drawPhoto = () => photoPrev.replaceChildren(mealPhoto ? h('div', { class: 'line' },
      h('img', { src: mealPhoto, alt: 'фото еды', style: 'width:64px;height:64px;object-fit:cover;border-radius:12px' }),
      h('button', { class: 'link', type: 'button', text: 'убрать фото', onclick: () => { mealPhoto = null; drawPhoto(); } })) : '');
    drawPhoto();
    const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) resizePhoto(f, (u) => { mealPhoto = u; drawPhoto(); }); } });
    const add = () => {
      const v = text.value.trim();
      if (!v) { text.focus(); return; }
      D.addMeal(L.cap(v), Number(kcal.value) || auto, mealPhoto);
      mealPhoto = null;
      toast('записано'); refresh();
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    estimate();
    root.append(card('',
      label('добавить'),
      h('div', { class: 'form', style: 'margin-top:10px' },
        h('div', { class: 'line' }, text, kcal), est,
        h('div', { class: 'chips scroll' }, QUICK_FOOD.map((q) => h('button', { class: 'chip', type: 'button', text: q, onclick: () => { text.value = q; estimate(); } }))),
        photoPrev,
        h('div', { class: 'line' },
          h('button', { class: 'btn', type: 'button', 'aria-label': 'сфотографировать еду', onclick: () => file.click() }, icon('camera')),
          h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: 'добавить', onclick: add })),
        file)));

    if (meals.length) {
      root.append(section('сегодня', h('span', { class: 'when', text: meals.length + ' ' + plural(meals.length, 'приём', 'приёма', 'приёмов') })));
      root.append(card('', meals.map((m) => h('div', { class: 'item' },
        m.photo ? h('img', { src: m.photo, alt: '', style: 'width:46px;height:46px;flex:none;object-fit:cover;border-radius:12px' }) : null,
        h('div', { class: 'item-body' }, h('p', { class: 'item-title', text: m.text }), h('p', { class: 'item-meta', text: mealPart(m.t) + ' · ' + hm(m.t) })),
        h('span', { class: 'amount', text: m.kcal ? fmt(m.kcal) : '—' }),
        h('button', { class: 'link', type: 'button', 'aria-label': 'удалить: ' + m.text, onclick: () => {
          const i = D.S.meals.indexOf(m); D.S.meals.splice(i, 1); save();
          toast('удалено', () => { D.S.meals.splice(i, 0, m); save(); refresh(); }); refresh();
        } }, '×')))));
    } else {
      root.append(empty('сегодня ещё ничего', 'Запиши текстом, сфотографируй или скажи в микрофон: «на обед гречка с курицей», «выпил стакан воды».'));
    }

    // неделя
    const bars = h('div', { class: 'bars' });
    let maxK = 1;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = L.addDays(new Date(), -i), k = L.dkey(d);
      const v = S.meals.filter((m) => L.dkey(new Date(m.t)) === k).reduce((a, m) => a + m.kcal, 0);
      days.push([d, v]); maxK = Math.max(maxK, v, S.goals.kcal * 0.6);
    }
    days.forEach((x) => bars.append(h('div', { class: 'b' }, h('div', { class: 'v' + (x[1] ? '' : ' zero'), style: 'height:' + Math.max(3, x[1] / maxK * 100) + '%', title: fmt(x[1]) + ' ккал' }), h('span', { class: 'd', text: L.WD_SHORT[x[0].getDay()] }))));
    root.append(card('', h('div', { class: 'tile-head' }, label('7 дней'), h('button', { class: 'link', style: 'min-height:0;padding:0', type: 'button', text: 'цели', onclick: () => go('settings') })), bars));
    return root;
  }

  function mealPart(ts) {
    const hr = new Date(ts).getHours();
    return hr < 11 ? 'завтрак' : hr < 16 ? 'обед' : hr < 21 ? 'ужин' : 'перекус';
  }

  /* ================= деньги ================= */

  let moneyKind = 'exp', moneyCatPick = '';

  function pMoney(mk) {
    const S = D.S, root = h('div', { class: 'stack' });
    const cur = L.monthKey(new Date());
    mk = /^\d{4}-\d{2}$/.test(mk || '') ? mk : cur;
    const md = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5)) - 1, 1);
    const month = D.monthMoney(mk);
    const exp = month.filter((m) => m.kind === 'exp').reduce((a, m) => a + m.amount, 0);
    const inc = month.filter((m) => m.kind === 'inc').reduce((a, m) => a + m.amount, 0);
    const bal = inc - exp;
    const shift = (n) => go('money', L.monthKey(L.addMonths(md, n, 1)));

    root.append(card('dots',
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'прошлый месяц', onclick: () => shift(-1) }, icon('left')),
        h('p', { class: 'lead', text: D.MONTHS_NOM[md.getMonth()] + (md.getFullYear() !== new Date().getFullYear() ? ' ' + md.getFullYear() : '') }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'следующий месяц', disabled: mk >= cur, style: mk >= cur ? 'opacity:.3' : '', onclick: () => { if (mk < cur) shift(1); } }, icon('right'))),
      label('баланс', 'tiny'),
      h('p', { class: 'num' }, (bal < 0 ? '−' : '') + fmt(Math.abs(bal)), h('small', { text: '₸' })),
      h('div', { class: 'grid', style: 'margin-top:14px' },
        h('div', null, label('доходы'), h('p', { class: 'lead', text: '+' + fmt(inc) + ' ₸' })),
        h('div', null, label('расходы'), h('p', { class: 'lead', text: '−' + fmt(exp) + ' ₸' })))));

    // бюджет
    if (mk === cur) {
      if (S.budget > 0) {
        const daysLeft = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate() - new Date().getDate() + 1;
        const left = S.budget - exp;
        const bfill = h('div', { class: 'fill' + (left < 0 ? ' over' : '') });
        root.append(tapCard('', budgetSheet,
          h('div', { class: 'tile-head' }, label('бюджет на месяц'), h('span', { class: 'when', text: 'изменить' })),
          h('p', { class: 'num sm' }, fmt(Math.abs(left)), h('small', { text: left >= 0 ? '₸ осталось' : '₸ сверх' })),
          h('div', { class: 'track' }, bfill),
          h('p', { class: 'cap', text: left >= 0 ? 'это ' + fmt(left / daysLeft) + ' ₸ в день до конца месяца' : 'бюджет ' + fmt(S.budget) + ' ₸ превышен' })));
        requestAnimationFrame(() => requestAnimationFrame(() => { bfill.style.width = Math.min(100, exp / S.budget * 100) + '%'; }));
      } else {
        root.append(tapCard('', budgetSheet, label('бюджет'), h('p', { class: 'lead', text: 'Настрой бюджет →' }), h('p', { class: 'cap', text: 'Приложение покажет, сколько можно тратить в день.' })));
      }

      // добавить
      const amount = h('input', { class: 'field', type: 'number', inputmode: 'decimal', placeholder: 'сумма, ₸', 'aria-label': 'сумма' });
      const text = h('input', { class: 'field', placeholder: moneyKind === 'exp' ? 'на что: такси, продукты' : 'откуда: зарплата', maxlength: '60', enterkeyhint: 'done', 'aria-label': 'описание' });
      const cats = L.MONEY_CAT_LIST;
      const csel = h('select', { class: 'select', 'aria-label': 'категория', value: moneyCatPick || '', onchange: (e) => { moneyCatPick = e.target.value; } },
        h('option', { value: '', text: 'категория: сама' }), cats.map((c) => h('option', { value: c, text: c })));
      text.addEventListener('input', () => { if (!moneyCatPick && moneyKind === 'exp') csel.options[0].text = 'категория: ' + L.moneyCat(text.value); });
      const add = () => {
        const v = Number(String(amount.value).replace(',', '.'));
        if (!(v > 0)) { amount.focus(); return; }
        const cat = moneyKind === 'inc' ? 'доход' : (moneyCatPick || L.moneyCat(text.value));
        if (D.addMoney(moneyKind, v, L.cap(text.value.trim()), cat)) { moneyCatPick = ''; toast((moneyKind === 'exp' ? '−' : '+') + fmt(v) + ' ₸'); refresh(); }
      };
      text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      root.append(card('',
        chips([['exp', 'расход'], ['inc', 'доход']], moneyKind, (k) => { moneyKind = k; refresh(); }),
        h('div', { class: 'form', style: 'margin-top:10px' },
          h('div', { class: 'line' }, amount, text),
          moneyKind === 'exp' ? csel : null,
          h('button', { class: 'btn solid block', type: 'button', text: 'добавить', onclick: add }))));
      const ll = D.limitLine('записей в месяце', month.length, 'moneyMonth');
      if (ll) root.append(ll);
    }

    // по категориям
    const byCat = {};
    month.filter((m) => m.kind === 'exp').forEach((m) => { const c = m.cat || L.moneyCat(m.text); byCat[c] = (byCat[c] || 0) + m.amount; });
    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    if (cats.length) {
      const top = byCat[cats[0]];
      const box = card('', label('расходы по категориям'));
      const fills = [];
      cats.forEach((c, i) => {
        const f = h('div', { class: 'fill' }); fills.push([f, byCat[c] / top * 100]);
        box.append(h('div', { class: 'hbar', style: i ? '' : 'margin-top:14px' }, h('span', { text: c }), h('div', { class: 'track' }, f), h('span', { class: 'amount', text: fmt(byCat[c]) })));
      });
      requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((x) => { x[0].style.width = x[1] + '%'; })));
      root.append(box);
    }

    // записи по дням
    if (month.length) {
      const byDay = {};
      month.forEach((m) => { const k = L.dkey(new Date(m.t)); (byDay[k] = byDay[k] || []).push(m); });
      Object.keys(byDay).sort().reverse().forEach((k) => {
        const list = byDay[k];
        const dsum = list.reduce((a, m) => a + (m.kind === 'exp' ? -m.amount : m.amount), 0);
        root.append(section(D.dateLabel(k), h('span', { class: 'when', text: (dsum < 0 ? '−' : '+') + fmt(Math.abs(dsum)) + ' ₸' })));
        root.append(card('', list.map((m) => h('div', { class: 'item' },
          h('div', { class: 'item-body' }, h('p', { class: 'item-title', text: m.text || (m.kind === 'exp' ? 'расход' : 'доход') }), h('p', { class: 'item-meta', text: (m.cat || '') + ' · ' + hm(m.t) })),
          h('span', { class: 'amount', text: (m.kind === 'exp' ? '−' : '+') + fmt(m.amount) + ' ₸' }),
          h('button', { class: 'link', type: 'button', 'aria-label': 'удалить запись', onclick: () => {
            const i = D.S.money.indexOf(m); D.S.money.splice(i, 1); save();
            toast('удалено', () => { D.S.money.splice(i, 0, m); save(); refresh(); }); refresh();
          } }, '×')))));
      });
    } else {
      root.append(empty('записей нет', mk === cur ? 'Добавь вручную или скажи: «купил продукты за 7 тысяч», «пришла зарплата 350 000».' : 'В этом месяце ничего не записано.'));
    }
    return root;
  }

  function budgetSheet() {
    D.openSheet((p) => {
      const input = h('input', { class: 'field', type: 'number', inputmode: 'numeric', placeholder: 'например, 250000', value: D.S.budget || '', 'aria-label': 'бюджет на месяц' });
      const ok = () => { D.S.budget = Math.max(0, Number(input.value) || 0); save(); D.closeSheet(); toast(D.S.budget ? 'бюджет сохранён' : 'бюджет выключен'); refresh(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
      p.append(h('h2', { text: 'бюджет на месяц' }), h('p', { class: 'cap', text: 'Сколько ты готов тратить за месяц. 0 выключает бюджет.' }),
        h('div', { class: 'form' }, input, h('button', { class: 'btn solid block', type: 'button', text: 'сохранить', onclick: ok })));
      setTimeout(() => input.focus(), 350);
    });
  }

  D.page('digest', '', pDigest, 'digest');
  D.page('tasks', 'Задачи', pTasks, 'digest');
  D.page('notes', 'Заметки', pNotes, 'digest');
  D.page('food', 'Еда', pFood, 'digest');
  D.page('money', 'Деньги', pMoney, 'digest');
})();
