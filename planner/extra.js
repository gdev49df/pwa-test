/* страницы вне нижней панели: календарь, фокус, привычки, списки, статистика, timeline, поиск, сброс дня, меню, pro и служебные */
(function () {
  'use strict';
  const D = window.DDX, L = D.L, C = D.C;
  const { h, icon, card, tapCard, label, empty, section, chips, today, tomorrow, fmt, plural, hm, go, save, toast, refresh } = D;

  /* ================= календарь ================= */

  let calView = 'month', calMonth = null, calSel = null;

  // задачи на день, включая будущие повторы, которые ещё не созданы
  function itemsOn(k) {
    const S = D.S;
    const real = S.tasks.filter((t) => t.due === k && (!t.done || t.doneKey));
    const ghosts = [];
    if (k > today()) {
      S.tasks.filter((t) => !t.done && t.repeat && t.due && t.due < k).forEach((t) => {
        let d = t.due, guard = 0;
        while (d < k && guard++ < 400) d = L.nextDue(d, t.repeat);
        if (d === k) ghosts.push(Object.assign({}, t, { ghost: true, due: k }));
      });
    }
    return real.concat(ghosts).sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')) || (a.done - b.done));
  }

  function pCalendar(p) {
    const root = h('div', { class: 'stack' });
    if (/^\d{4}-\d{2}-\d{2}$/.test(p || '')) { calSel = p; calMonth = L.fromKey(p); }
    if (!calSel) calSel = today();
    if (!calMonth) calMonth = L.fromKey(calSel);
    const sel = L.fromKey(calSel);

    root.append(chips([['month', 'месяц'], ['week', 'неделя'], ['day', 'день']], calView, (k) => { calView = k; refresh(); }));

    const pick = (k) => { calSel = k; calMonth = L.fromKey(k); refresh(); };

    if (calView === 'month') {
      const y = calMonth.getFullYear(), m = calMonth.getMonth();
      const grid = h('div', { class: 'cal' }, ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => h('span', { class: 'wd', text: w })));
      const start = L.weekStart(new Date(y, m, 1));
      for (let i = 0; i < 42; i++) {
        const d = L.addDays(start, i), k = L.dkey(d);
        if (i >= 35 && d.getMonth() !== m) break;
        const n = itemsOn(k).length;
        grid.append(h('button', {
          class: 'day' + (d.getMonth() !== m ? ' out' : '') + (k === today() ? ' today' : '') + (k === calSel ? ' sel' : ''), type: 'button',
          'aria-label': d.getDate() + ' ' + D.MONTHS[d.getMonth()] + ', ' + n + ' ' + plural(n, 'дело', 'дела', 'дел'), onclick: () => pick(k)
        }, String(d.getDate()), n ? h('span', { class: 'marks' }, Array.from({ length: Math.min(3, n) }, () => h('i'))) : null));
      }
      root.append(card('',
        h('div', { class: 'cal-head' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'прошлый месяц', onclick: () => { calMonth = new Date(y, m - 1, 1); refresh(); } }, icon('left')),
          h('p', { class: 'lead', text: D.MONTHS_NOM[m] + ' ' + y }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'следующий месяц', onclick: () => { calMonth = new Date(y, m + 1, 1); refresh(); } }, icon('right'))),
        grid));
    } else {
      const ws = L.weekStart(sel);
      const strip = h('div', { class: 'week-strip' });
      for (let i = 0; i < 7; i++) {
        const d = L.addDays(ws, i), k = L.dkey(d), n = itemsOn(k).length;
        strip.append(h('button', { class: 'day' + (k === today() ? ' today' : '') + (k === calSel ? ' sel' : ''), type: 'button', onclick: () => pick(k) },
          h('small', { text: L.WD_SHORT[d.getDay()] }), String(d.getDate()), n ? h('span', { class: 'marks' }, Array.from({ length: Math.min(3, n) }, () => h('i'))) : null));
      }
      root.append(card('',
        h('div', { class: 'cal-head' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': calView === 'week' ? 'прошлая неделя' : 'вчера', onclick: () => pick(L.dkey(L.addDays(sel, calView === 'week' ? -7 : -1))) }, icon('left')),
          h('p', { class: 'lead', text: calView === 'week' ? ws.getDate() + ' ' + D.MON_SHORT[ws.getMonth()] + ' – ' + L.addDays(ws, 6).getDate() + ' ' + D.MON_SHORT[L.addDays(ws, 6).getMonth()] : D.WEEKDAYS[sel.getDay()] }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': calView === 'week' ? 'следующая неделя' : 'завтра', onclick: () => pick(L.dkey(L.addDays(sel, calView === 'week' ? 7 : 1))) }, icon('right'))),
        strip));
    }

    const items = itemsOn(calSel);
    root.append(section(D.dateLabel(calSel) + (calSel === today() || calSel === tomorrow() ? ', ' + sel.getDate() + ' ' + D.MONTHS[sel.getMonth()] : ''),
      h('button', { class: 'link', style: 'min-height:0;padding:0', type: 'button', text: '+ добавить', onclick: () => D.taskSheet(null, { due: calSel }) })));
    if (!items.length) {
      root.append(empty('свободный день', 'Нажми «добавить» или скажи в микрофон: «встреча с Асетом ' + (calSel === tomorrow() ? 'завтра' : 'в пятницу') + ' в 15:00».'));
    } else if (calView === 'day') {
      root.append(card('', items.map((t) => h('div', { class: 'hour tap', onclick: () => (t.ghost ? toast('это будущий повтор задачи') : D.taskSheet(t)) },
        h('span', { class: 'h', text: t.time || 'весь день' }),
        h('div', { class: 'item-body' + (t.done ? ' done' : '') }, h('p', { class: 'item-title', text: t.title }),
          h('p', { class: 'item-meta', text: [t.kind === 'meeting' ? 'встреча' : 'задача', t.ghost ? 'повтор' : '', t.place].filter(Boolean).join(' · ') }))))));
    } else {
      root.append(card('', items.map((t) => h('div', { class: 'item' + (t.done ? ' done' : '') },
        h('button', { class: 'check' + (t.done ? ' on' : ''), type: 'button', disabled: t.ghost, style: t.ghost ? 'opacity:.35' : '', 'aria-label': 'выполнить: ' + t.title, onclick: () => { D.toggleTask(t); refresh(); } }),
        h('div', { class: 'item-body tap', onclick: () => (t.ghost ? toast('это будущий повтор задачи') : D.taskSheet(t)) },
          h('p', { class: 'item-title', text: t.title }),
          h('p', { class: 'item-meta', text: [t.time, t.kind === 'meeting' ? 'встреча' : '', t.ghost ? L.repeatLabel(t.repeat) : '', t.place].filter(Boolean).join(' · ') || 'весь день' }))))));
    }

    // траты и еда в этот день
    const k = calSel;
    const spent = D.S.money.filter((m) => m.kind === 'exp' && L.dkey(new Date(m.t)) === k).reduce((a, m) => a + m.amount, 0);
    const kc = D.S.meals.filter((m) => L.dkey(new Date(m.t)) === k).reduce((a, m) => a + m.kcal, 0);
    if (spent || kc) root.append(card('flat', h('div', { class: 'grid' },
      h('div', null, label('потрачено'), h('p', { class: 'lead', text: fmt(spent) + ' ₸' })),
      h('div', null, label('калории'), h('p', { class: 'lead', text: fmt(kc) + ' ккал' })))));
    return root;
  }

  /* ================= focus mode ================= */

  let focusTimer = null, focusPick = null, focusMin = 25;

  function pFocus(p) {
    const S = D.S, root = h('div', { class: 'stack' });
    clearInterval(focusTimer);
    const f = S.focus.active;
    const tasks = D.activeTasks().sort(D.TASK_SORT);
    if (p && tasks.some((t) => t.id === p)) focusPick = p;

    if (f) {
      const t = S.tasks.find((x) => x.id === f.taskId);
      const R = 46, LEN = 2 * Math.PI * R;
      const ring = h('div', { class: 'ring' });
      ring.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#7a7a80"/></linearGradient></defs>' +
        '<circle class="bg" cx="50" cy="50" r="' + R + '"/><circle class="fg" cx="50" cy="50" r="' + R + '" stroke-dasharray="' + LEN + '" stroke-dashoffset="' + LEN + '"/></svg>';
      const clockEl = h('p', { class: 'clock', role: 'timer', 'aria-live': 'off' });
      const of = h('p', { class: 'of' });
      ring.append(h('div', { class: 'mid' }, clockEl, of));
      const fg = ring.querySelector('.fg');
      const tick = () => {
        if (D.route !== 'focus') { clearInterval(focusTimer); return; }
        const left = D.focusLeft(), total = f.min * 60000;
        clockEl.textContent = D.clock(left);
        of.textContent = f.paused != null ? 'пауза' : 'из ' + f.min + ' минут';
        fg.style.strokeDashoffset = String(LEN * (left / total));
        if (left <= 0) D.tickFocus();
      };
      tick();
      focusTimer = setInterval(tick, 1000);
      root.append(card('dots', label('сейчас в фокусе'), h('p', { class: 'lead', text: t ? t.title : 'Свободный фокус' }), ring,
        h('div', { class: 'line', style: 'margin-top:18px' },
          h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: f.paused != null ? 'продолжить' : 'пауза', onclick: () => {
            if (f.paused != null) { f.end = Date.now() + f.paused; f.paused = null; } else { f.paused = Math.max(0, f.end - Date.now()); }
            save(); refresh();
          } }),
          h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'завершить', onclick: () => { D.finishFocus(false); toast('фокус остановлен'); refresh(); } })),
        t ? h('button', { class: 'btn block', style: 'margin-top:8px', type: 'button', text: 'задача выполнена', onclick: () => { D.finishFocus(false); D.toggleTask(t); toast('отлично, задача выполнена'); refresh(); } }) : null));
      root.append(h('p', { class: 'cap', style: 'margin:4px 6px', text: 'Таймер идёт, даже если закрыть приложение. По окончании придёт уведомление, если оно разрешено в настройках.' }));
    } else {
      const sel = h('select', { class: 'select', 'aria-label': 'задача для фокуса', value: focusPick || '', onchange: (e) => { focusPick = e.target.value || null; } },
        h('option', { value: '', text: 'без задачи' }), tasks.map((t) => h('option', { value: t.id, text: t.title.slice(0, 60) })));
      root.append(card('dots',
        label('focus mode'),
        h('p', { class: 'num' }, String(focusMin), h('small', { text: 'минут' })),
        h('p', { class: 'cap', text: 'На экране останется только задача, таймер и прогресс.' }),
        h('div', { class: 'form', style: 'margin-top:14px' },
          chips([[25, '25 мин'], [45, '45 мин'], [60, '60 мин']], focusMin, (k) => { focusMin = k; refresh(); }),
          sel,
          h('button', { class: 'btn solid block', type: 'button', text: 'начать', onclick: () => { if (D.startFocus(focusMin, focusPick)) refresh(); } }))));
      if (!D.isPro()) root.append(label('сегодня: ' + D.usage().focus + ' из ' + C.limits.focusDay, 'tiny'));
    }

    const todayLog = S.focus.log.filter((x) => L.dkey(new Date(x.t)) === today());
    const mins = todayLog.reduce((a, x) => a + x.min, 0);
    const week = S.focus.log.filter((x) => x.t > Date.now() - 7 * 86400000).reduce((a, x) => a + x.min, 0);
    root.append(h('div', { class: 'grid' },
      card('', label('сегодня'), h('p', { class: 'num sm' }, String(mins), h('small', { text: 'мин' })), h('p', { class: 'cap', text: todayLog.length + ' ' + plural(todayLog.length, 'сессия', 'сессии', 'сессий') })),
      card('', label('7 дней'), h('p', { class: 'num sm' }, String(week), h('small', { text: 'мин' })), h('p', { class: 'cap', text: 'в фокусе' }))));
    if (todayLog.length) {
      root.append(card('', todayLog.map((x) => {
        const t = S.tasks.find((y) => y.id === x.taskId);
        return h('div', { class: 'kv' }, h('span', { text: (t ? t.title : 'Свободный фокус').slice(0, 40) }), h('span', { class: 'muted', text: hm(x.t) + ', ' + x.min + ' мин' }));
      })));
    }
    return root;
  }

  /* ================= привычки ================= */

  let habitEdit = false;
  function pHabits() {
    const S = D.S, root = h('div', { class: 'stack' }), t0 = today();
    root.append(D.mark('RITUALS'));
    const input = h('input', { class: 'field', placeholder: 'зарядка, 2 литра воды, 10 минут чтения', maxlength: '50', enterkeyhint: 'done', 'aria-label': 'новая привычка' });
    const add = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } if (D.addHabit(L.cap(v))) { toast('привычка добавлена'); refresh(); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.append(card('', h('div', { class: 'line' }, input, h('button', { class: 'btn solid', type: 'button', 'aria-label': 'добавить привычку', onclick: add }, icon('plus')))));
    const ll = D.limitLine('привычек', S.habits.length, 'habits');
    if (ll) root.append(ll);

    if (!S.habits.length) {
      root.append(empty('привычек пока нет', 'Добавь первую и отмечай каждый день. Приложение посчитает серию дней подряд.'));
      return root;
    }
    const done = S.habits.filter((x) => x.days[t0]).length;
    root.append(section('сегодня ' + done + ' из ' + S.habits.length, h('button', { class: 'link', style: 'min-height:0;padding:0', type: 'button', text: habitEdit ? 'готово' : 'изменить', onclick: () => { habitEdit = !habitEdit; refresh(); } })));

    S.habits.forEach((x) => {
      const n = L.streak(x.days, t0);
      let month = 0;
      for (let i = 0; i < 30; i++) if (x.days[L.dkey(L.addDays(new Date(), -i))]) month++;
      const week = h('div', { class: 'hab-week' });
      for (let i = 6; i >= 0; i--) {
        const d = L.addDays(new Date(), -i), k = L.dkey(d), on = !!x.days[k];
        week.append(h('div', { class: 'hab-cell' },
          h('button', { class: 'hab-dot' + (on ? ' on' : '') + (i === 0 ? ' today' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
            'aria-label': x.name + ', ' + D.dateLabel(k) + (on ? ', отмечено' : ''), onclick: () => { D.markHabit(x, k, !on); refresh(); } }),
          h('small', { text: i === 0 ? 'сег' : L.WD_SHORT[d.getDay()] })));
      }
      root.append(card(n >= 3 ? 'dots' : '',
        h('div', { class: 'tile-head' },
          h('div', { style: 'min-width:0' }, h('p', { class: 'lead', style: 'margin:0', text: x.name }), h('p', { class: 'cap', text: month + ' из 30 дней' })),
          h('div', { style: 'text-align:right' }, h('p', { class: 'num xs', style: 'margin:0', text: String(n) }), label(plural(n, 'день подряд', 'дня подряд', 'дней подряд')))),
        week,
        habitEdit ? h('div', { class: 'actions' },
          h('button', { class: 'link', type: 'button', text: 'переименовать', onclick: () => {
            D.openSheet((p) => {
              const inp = h('input', { class: 'field', value: x.name, maxlength: '50', 'aria-label': 'название привычки' });
              p.append(h('h2', { text: 'переименовать' }), h('div', { class: 'form' }, inp, h('button', { class: 'btn solid block', type: 'button', text: 'сохранить', onclick: () => { const v = inp.value.trim(); if (v) { x.name = L.cap(v); save(); } D.closeSheet(); refresh(); } })));
            });
          } }),
          h('button', { class: 'link', type: 'button', text: 'удалить', onclick: () => D.ask('удалить привычку?', '«' + x.name + '» и вся её история пропадут.', 'удалить', () => { D.S.habits = D.S.habits.filter((y) => y !== x); save(); refresh(); }) })) : null));
    });
    return root;
  }

  /* ================= умные списки ================= */

  function pLists() {
    const S = D.S, root = h('div', { class: 'stack' });
    root.append(card('dots', label('новый список'),
      h('p', { class: 'cap', text: 'Скажи в микрофон «добавь в покупки молоко и хлеб», и пункты появятся сами.' }),
      h('div', { class: 'chips', style: 'margin-top:12px' },
        Object.keys(D.LIST_NAMES).map((k) => h('button', { class: 'chip', type: 'button', text: D.LIST_NAMES[k], disabled: S.lists.some((l) => l.kind === k), style: S.lists.some((l) => l.kind === k) ? 'opacity:.35' : '', onclick: () => {
          const l = D.listFor(k, true); if (l) { save(); go('list', l.id); }
        } })),
        h('button', { class: 'chip', type: 'button', text: 'свой…', onclick: () => {
          D.openSheet((p) => {
            const inp = h('input', { class: 'field', placeholder: 'подарки, в поездку, рецепты', maxlength: '30', 'aria-label': 'название списка' });
            const ok = () => {
              const v = inp.value.trim(); if (!v) return;
              if (D.S.lists.length >= D.lim('lists')) { D.limitHit('lists'); return; }
              const l = { id: D.uid(), kind: 'custom', name: L.cap(v), items: [], created: Date.now() };
              D.S.lists.push(l); save(); D.closeSheet(); go('list', l.id);
            };
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
            p.append(h('h2', { text: 'свой список' }), h('div', { class: 'form' }, inp, h('button', { class: 'btn solid block', type: 'button', text: 'создать', onclick: ok })));
            setTimeout(() => inp.focus(), 350);
          });
        } }))));
    const ll = D.limitLine('списков', S.lists.length, 'lists');
    if (ll) root.append(ll);
    if (!S.lists.length) { root.append(empty('списков пока нет', 'Покупки, желания, книги, фильмы и чек-листы. Выбери шаблон выше.')); return root; }
    root.append(h('div', { class: 'grid' }, S.lists.map((l) => {
      const open = l.items.filter((x) => !x.done);
      return tapCard('tile', () => go('list', l.id), label(l.name),
        h('p', { class: 'num sm', text: String(open.length) }),
        h('p', { class: 'cap clamp', style: '-webkit-line-clamp:2', text: open.length ? open.slice(0, 3).map((x) => x.t).join(', ') : 'пусто' }));
    })));
    return root;
  }

  function pList(id) {
    const S = D.S, root = h('div', { class: 'stack' });
    const l = S.lists.find((x) => x.id === id);
    if (!l) { root.append(empty('списка нет', 'Возможно, его удалили.')); return root; }
    const input = h('input', { class: 'field', placeholder: l.kind === 'shop' ? 'молоко, хлеб, яйца' : 'новый пункт', maxlength: '200', enterkeyhint: 'done', 'aria-label': 'новый пункт' });
    const add = () => {
      const v = input.value.trim(); if (!v) { input.focus(); return; }
      D.addListItems(l, /^(books|movies)$/.test(l.kind) ? [L.cap(v)] : L.splitItems(v));
      refresh(); setTimeout(() => { const i = document.querySelector('#view input'); if (i) i.focus(); }, 0);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.append(card('', h('div', { class: 'line' }, input, h('button', { class: 'btn solid', type: 'button', 'aria-label': 'добавить', onclick: add }, icon('plus'))),
      h('p', { class: 'cap', style: 'margin:8px 2px 0', text: 'можно несколько через запятую' })));
    const open = l.items.filter((x) => !x.done), done = l.items.filter((x) => x.done);
    const row = (x) => h('div', { class: 'item' + (x.done ? ' done' : '') },
      h('button', { class: 'check sq' + (x.done ? ' on' : ''), type: 'button', 'aria-label': x.t, onclick: () => { x.done = !x.done; x.doneAt = Date.now(); save(); refresh(); } }),
      h('div', { class: 'item-body' }, h('p', { class: 'item-title', text: x.t })),
      h('button', { class: 'link', type: 'button', 'aria-label': 'удалить ' + x.t, onclick: () => { const i = l.items.indexOf(x); l.items.splice(i, 1); save(); toast('удалено', () => { l.items.splice(i, 0, x); save(); refresh(); }); refresh(); } }, '×'));
    if (open.length) root.append(card('', open.map(row)));
    else root.append(empty('всё отмечено', 'Добавь новые пункты выше или голосом.'));
    if (done.length) {
      root.append(section(l.kind === 'shop' ? 'куплено' : 'готово', h('button', { class: 'link', style: 'min-height:0;padding:0', type: 'button', text: 'очистить', onclick: () => { l.items = l.items.filter((x) => !x.done); save(); refresh(); } })));
      root.append(card('', done.map(row)));
    }
    root.append(h('div', { class: 'line', style: 'margin-top:8px' },
      h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'копировать', onclick: () => {
        const txt = l.name + '\n' + open.map((x) => '— ' + x.t).join('\n');
        if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('скопировано'));
      } }),
      h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'удалить список', onclick: () => D.ask('удалить список?', '«' + l.name + '» и все пункты пропадут.', 'удалить', () => { D.S.lists = D.S.lists.filter((x) => x !== l); save(); go('lists'); }) })));
    return root;
  }

  /* ================= статистика ================= */

  let statDays = 7;
  function pStats() {
    const S = D.S, root = h('div', { class: 'stack' });
    root.append(chips([[7, '7 дней'], [30, '30 дней'], [90, '90 дней']], statDays, (k) => {
      if (k > C.limits.statsDays && !D.isPro()) { D.limitHit('statsDays'); refresh(); return; }
      statDays = k; refresh();
    }));
    const n = statDays;
    const keys = []; for (let i = n - 1; i >= 0; i--) keys.push(L.dkey(L.addDays(new Date(), -i)));
    const from = L.fromKey(keys[0]).getTime();

    const doneBy = {}; S.tasks.forEach((t) => { if (t.done && t.doneKey) doneBy[t.doneKey] = (doneBy[t.doneKey] || 0) + 1; });
    const expBy = {}; S.money.forEach((m) => { if (m.kind === 'exp') { const k = L.dkey(new Date(m.t)); expBy[k] = (expBy[k] || 0) + m.amount; } });
    const doneTotal = keys.reduce((a, k) => a + (doneBy[k] || 0), 0);
    const created = S.tasks.filter((t) => t.created >= from).length;
    const expTotal = keys.reduce((a, k) => a + (expBy[k] || 0), 0);
    const incTotal = S.money.filter((m) => m.kind === 'inc' && m.t >= from).reduce((a, m) => a + m.amount, 0);
    const focusMin = S.focus.log.filter((x) => x.t >= from).reduce((a, x) => a + x.min, 0);
    const notes = S.notes.filter((x) => x.t >= from).length;
    let habPossible = 0, habDone = 0;
    S.habits.forEach((x) => keys.forEach((k) => { if (L.dkey(new Date(x.created)) <= k) { habPossible++; if (x.days[k]) habDone++; } }));
    const kcalDays = keys.map((k) => S.meals.filter((m) => L.dkey(new Date(m.t)) === k).reduce((a, m) => a + m.kcal, 0)).filter(Boolean);
    const waterDays = keys.map((k) => S.water[k] || 0).filter(Boolean);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

    const barsFor = (by, fmtv) => {
      const step = n > 30 ? 7 : 1;
      const groups = [];
      for (let i = 0; i < keys.length; i += step) groups.push(keys.slice(i, i + step));
      const vals = groups.map((g) => g.reduce((a, k) => a + (by[k] || 0), 0));
      const max = Math.max(1, ...vals);
      return h('div', { class: 'bars' }, groups.map((g, i) => {
        const d = L.fromKey(g[0]);
        return h('div', { class: 'b' }, h('div', { class: 'v' + (vals[i] ? '' : ' zero'), style: 'height:' + Math.max(3, vals[i] / max * 100) + '%', title: fmtv(vals[i]) }),
          h('span', { class: 'd', text: n <= 7 ? L.WD_SHORT[d.getDay()] : n <= 30 ? (i % 5 === 0 ? String(d.getDate()) : '') : d.getDate() + '.' + D.pad(d.getMonth() + 1) }));
      }));
    };

    root.append(card('dots', h('div', { class: 'tile-head' }, label('выполнено задач'), h('span', { class: 'when', text: 'создано ' + created })),
      h('p', { class: 'num' }, String(doneTotal)), h('p', { class: 'cap', text: 'в среднем ' + (doneTotal / n).toFixed(1).replace('.', ',') + ' в день' }), barsFor(doneBy, (v) => v + ' задач')));
    root.append(card('', h('div', { class: 'tile-head' }, label('расходы'), h('span', { class: 'when', text: 'доходы +' + fmt(incTotal) + ' ₸' })),
      h('p', { class: 'num sm' }, fmt(expTotal), h('small', { text: '₸' })), h('p', { class: 'cap', text: 'в среднем ' + fmt(expTotal / n) + ' ₸ в день' }), barsFor(expBy, (v) => fmt(v) + ' ₸')));
    root.append(h('div', { class: 'grid' },
      card('', label('привычки'), h('p', { class: 'num sm' }, (habPossible ? Math.round(habDone / habPossible * 100) : 0) + '%'), h('p', { class: 'cap', text: S.habits.length ? 'выполнение' : 'нет привычек' })),
      card('', label('фокус'), h('p', { class: 'num sm' }, String(focusMin), h('small', { text: 'мин' })), h('p', { class: 'cap', text: 'концентрации' })),
      card('', label('калории'), h('p', { class: 'num sm', text: fmt(avg(kcalDays)) }), h('p', { class: 'cap', text: 'ккал в среднем за день' })),
      card('', label('вода'), h('p', { class: 'num sm', text: fmt(avg(waterDays)) }), h('p', { class: 'cap', text: 'мл в среднем за день' })),
      card('span2', label('заметки'), h('p', { class: 'num sm', text: String(notes) }), h('p', { class: 'cap', text: 'новых за ' + n + ' ' + plural(n, 'день', 'дня', 'дней') }))));
    return root;
  }

  /* ================= timeline ================= */

  let tlFilter = 'all';
  function events(fromTs) {
    const S = D.S, ev = [];
    S.notes.forEach((n) => { if (n.t >= fromTs) ev.push({ t: n.t, type: 'note', label: n.cat || 'заметка', text: n.text }); });
    S.tasks.forEach((t) => {
      if (t.created >= fromTs) ev.push({ t: t.created, type: 'task', label: t.kind === 'meeting' ? 'встреча запланирована' : 'задача создана', text: t.title, ref: t });
      if (t.done && t.doneAt >= fromTs) ev.push({ t: t.doneAt, type: 'task', label: 'выполнено', text: t.title, ref: t });
      if (t.kind === 'meeting' && t.due && t.time && !t.done) { const ts = D.dueTs(t); if (ts >= fromTs && ts <= Date.now() + 86400000 * 0) ev.push({ t: ts, type: 'task', label: 'встреча', text: t.title, ref: t }); }
    });
    S.money.forEach((m) => { if (m.t >= fromTs) ev.push({ t: m.t, type: 'money', label: m.kind === 'exp' ? 'расход · ' + (m.cat || '') : 'доход', text: (m.kind === 'exp' ? '−' : '+') + fmt(m.amount) + ' ₸' + (m.text ? '  ' + m.text : '') }); });
    S.meals.forEach((m) => { if (m.t >= fromTs) ev.push({ t: m.t, type: 'food', label: 'еда', text: m.text + (m.kcal ? ', ' + m.kcal + ' ккал' : '') }); });
    S.focus.log.forEach((x) => { if (x.t >= fromTs) { const t = S.tasks.find((y) => y.id === x.taskId); ev.push({ t: x.t, type: 'task', label: 'фокус ' + x.min + ' мин', text: t ? t.title : 'Свободный фокус' }); } });
    return ev.sort((a, b) => b.t - a.t);
  }

  function pTimeline() {
    const root = h('div', { class: 'stack' });
    const days = D.isPro() ? 90 : C.limits.timelineDays;
    const from = L.addDays(new Date(), -(days - 1)).getTime();
    root.append(chips([['all', 'всё'], ['task', 'задачи'], ['note', 'заметки'], ['money', 'деньги'], ['food', 'еда']], tlFilter, (k) => { tlFilter = k; refresh(); }, 'scroll'));
    const ev = events(L.fromKey(L.dkey(new Date(from))).getTime()).filter((e) => tlFilter === 'all' || e.type === tlFilter);
    if (!ev.length) { root.append(empty('лента пуста', 'Здесь по порядку появятся заметки, задачи, встречи, расходы и еда.')); return root; }
    const byDay = {};
    ev.forEach((e) => { const k = L.dkey(new Date(e.t)); (byDay[k] = byDay[k] || []).push(e); });
    Object.keys(byDay).sort().reverse().forEach((k) => {
      root.append(section(D.dateLabel(k), h('span', { class: 'when', text: byDay[k].length + ' ' + plural(byDay[k].length, 'событие', 'события', 'событий') })));
      root.append(card('', byDay[k].map((e) => h('div', { class: 'hour' + (e.ref ? ' tap' : ''), onclick: e.ref ? () => D.taskSheet(e.ref) : null },
        h('span', { class: 'h', text: hm(e.t) }),
        h('div', { class: 'item-body' }, label(e.label), h('p', { class: 'item-title clamp', style: 'margin-top:3px;-webkit-line-clamp:2', text: e.text }))))));
    });
    if (!D.isPro()) root.append(label('показаны последние ' + days + ' дней. pro хранит всю историю', 'tiny'));
    return root;
  }

  /* ================= поиск ================= */

  let searchQ = '';
  function pSearch() {
    const root = h('div', { class: 'stack' });
    const input = h('input', { class: 'field', type: 'search', placeholder: 'слово, категория или дата: 12.11', value: searchQ, 'aria-label': 'поиск', enterkeyhint: 'search' });
    const box = h('div', { class: 'stack' });
    input.addEventListener('input', () => { searchQ = input.value; fill(); });
    root.append(input, box);
    setTimeout(() => { if (!searchQ) input.focus(); }, 300);

    function fill() {
      const S = D.S;
      box.replaceChildren();
      const q = searchQ.trim().toLowerCase();
      if (q.length < 2) { box.append(empty('что ищем?', 'Поиск идёт по задачам, заметкам, спискам, расходам и еде.')); return; }
      const dstr = (ts) => { const d = new Date(ts); return D.pad(d.getDate()) + '.' + D.pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + d.getDate() + ' ' + D.MONTHS[d.getMonth()]; };
      const has = (s) => String(s || '').toLowerCase().includes(q);
      const groups = [
        ['задачи', S.tasks.filter((t) => has(t.title) || has(t.place) || t.subs.some((s) => has(s.t)) || (t.due && has(D.pad(L.fromKey(t.due).getDate()) + '.' + D.pad(L.fromKey(t.due).getMonth() + 1)))).slice(0, 20)
          .map((t) => [t.title, (t.done ? 'выполнено · ' : '') + (t.due ? D.dueLabel(t.due, t.time) : 'без срока'), () => D.taskSheet(t)])],
        ['заметки', S.notes.filter((n) => has(n.text) || has(n.cat) || has(dstr(n.t))).slice(0, 20).map((n) => [n.text, (n.archived ? 'архив · ' : '') + (n.cat ? n.cat + ' · ' : '') + D.stampOf(n.t), () => go(n.archived ? 'archive' : 'notes')])],
        ['списки', [].concat.apply([], S.lists.map((l) => l.items.filter((x) => has(x.t) || has(l.name)).map((x) => [x.t, l.name + (x.done ? ' · отмечено' : ''), () => go('list', l.id)]))).slice(0, 20)],
        ['деньги', S.money.filter((m) => has(m.text) || has(m.cat) || has(dstr(m.t))).slice(0, 20).map((m) => [(m.kind === 'exp' ? '−' : '+') + fmt(m.amount) + ' ₸ ' + (m.text || ''), (m.cat || '') + ' · ' + D.stampOf(m.t), () => go('money', L.monthKey(new Date(m.t)))])],
        ['еда', S.meals.filter((m) => has(m.text) || has(dstr(m.t))).slice(0, 20).map((m) => [m.text, (m.kcal ? m.kcal + ' ккал · ' : '') + D.stampOf(m.t), () => go('food')])]
      ];
      let n = 0;
      groups.forEach((g) => {
        if (!g[1].length) return;
        n += g[1].length;
        box.append(section(g[0], h('span', { class: 'when', text: String(g[1].length) })),
          card('', g[1].map((r) => h('div', { class: 'item tap', onclick: r[2] }, h('div', { class: 'item-body' }, h('p', { class: 'item-title clamp', style: '-webkit-line-clamp:2', text: r[0] }), h('p', { class: 'item-meta', text: r[1] }))))));
      });
      if (!n) box.append(empty('ничего не нашлось', 'Попробуй другое слово.'));
    }
    fill();
    return root;
  }

  /* ================= daily reset ================= */

  function pReset() {
    const S = D.S, root = h('div', { class: 'stack' }), t0 = today();
    const pending = S.tasks.filter((t) => !t.done && t.due && t.due <= t0).sort(D.TASK_SORT);
    const doneToday = S.tasks.filter((t) => t.done && t.doneKey === t0).length;
    root.append(card('dots', label('итог дня'),
      h('p', { class: 'num' }, String(doneToday), h('small', { text: plural(doneToday, 'задача', 'задачи', 'задач') + ' выполнено' })),
      h('p', { class: 'cap', text: pending.length ? 'Осталось ' + pending.length + '. Реши, что с ними делать, и завтра начнётся с чистого листа.' : 'Все задачи на сегодня закрыты. Отличный день.' }),
      pending.length ? h('button', { class: 'btn solid block', style: 'margin-top:14px', type: 'button', text: 'всё на завтра', onclick: () => {
        const was = pending.map((t) => [t, t.due]);
        pending.forEach((t) => { t.due = tomorrow(); t.fired = false; }); save();
        toast('перенесено на завтра', () => { was.forEach((w) => { w[0].due = w[1]; }); save(); refresh(); }); refresh();
      } }) : null));
    pending.forEach((t) => {
      const date = h('input', { class: 'field', type: 'date', value: t.due, 'aria-label': 'новая дата для ' + t.title, onchange: (e) => { if (e.target.value) { t.due = e.target.value; t.fired = false; save(); toast('перенесено: ' + D.dateLabel(t.due)); refresh(); } } });
      root.append(card('',
        h('p', { class: 'item-title', text: t.title }), h('p', { class: 'item-meta', text: D.dueLabel(t.due, t.time) + (t.repeat ? ' · ' + L.repeatLabel(t.repeat) : '') }),
        h('div', { class: 'line', style: 'margin-top:12px' },
          h('button', { class: 'btn sm', type: 'button', text: 'на завтра', onclick: () => { t.due = tomorrow(); t.fired = false; save(); refresh(); } }),
          date,
          h('button', { class: 'btn sm', type: 'button', 'aria-label': 'готово: ' + t.title, text: '✓', onclick: () => { D.toggleTask(t); refresh(); } }),
          h('button', { class: 'btn sm', type: 'button', 'aria-label': 'удалить: ' + t.title, onclick: () => {
            const i = D.S.tasks.indexOf(t); D.S.tasks.splice(i, 1); save(); toast('удалено', () => { D.S.tasks.splice(i, 0, t); save(); refresh(); }); refresh();
          } }, icon('close')))));
    });
    const sel = h('select', { class: 'select', 'aria-label': 'время вечернего сброса', value: String(S.settings.resetHour), onchange: (e) => { S.settings.resetHour = Number(e.target.value); save(); toast('сохранено'); } },
      [17, 18, 19, 20, 21, 22, 23].map((x) => h('option', { value: String(x), text: 'показывать с ' + x + ':00' })));
    root.append(card('flat', label('вечерний сброс на главной'), h('div', { style: 'margin-top:10px' }, sel)));
    return root;
  }

  /* ================= спроси ии ================= */

  // короткая сводка по данным: уходит в воркер вместе с вопросом
  function lifeContext() {
    const S = D.S, t0 = today(), now = new Date(), out = [];
    out.push('Сегодня ' + D.WEEKDAYS[now.getDay()] + ', ' + now.getDate() + ' ' + D.MONTHS[now.getMonth()] + ' ' + now.getFullYear() + ', время ' + D.hm(now.getTime()) + '.');
    const act = D.activeTasks().filter((t) => t.kind !== 'meeting').sort(D.TASK_SORT).slice(0, 25);
    out.push('Активные задачи: ' + (act.map((t) => t.title + (t.due ? ' (' + D.dueLabel(t.due, t.time) + ')' : '')).join('; ') || 'нет') + '.');
    const meet = D.activeTasks().filter((t) => t.kind === 'meeting').sort((a, b) => D.dueTs(a) - D.dueTs(b)).slice(0, 10);
    out.push('Встречи: ' + (meet.map((t) => t.title + (t.due ? ' (' + D.dueLabel(t.due, t.time) + ')' : '')).join('; ') || 'нет') + '.');
    const meals = S.meals.filter((m) => L.dkey(new Date(m.t)) === t0);
    out.push('Еда сегодня: ' + (meals.map((m) => m.text + ' ' + m.kcal + ' ккал').join('; ') || 'ничего') + '. Цель ' + S.goals.kcal + ' ккал, воды выпито ' + (S.water[t0] || 0) + ' из ' + S.goals.water + ' мл.');
    const mk = D.monthMoney();
    const exp = mk.filter((m) => m.kind === 'exp').reduce((a, m) => a + m.amount, 0), inc = mk.filter((m) => m.kind === 'inc').reduce((a, m) => a + m.amount, 0);
    out.push('Деньги за месяц: расходы ' + exp + ' ₸, доходы ' + inc + ' ₸' + (S.budget ? ', бюджет ' + S.budget + ' ₸' : '') + '. Последние записи: ' + (mk.slice(0, 15).map((m) => (m.kind === 'exp' ? '−' : '+') + m.amount + ' ' + (m.text || m.cat || '')).join('; ') || 'нет') + '.');
    out.push('Привычки: ' + (S.habits.map((x) => x.name + ' (серия ' + L.streak(x.days, t0) + ', сегодня ' + (x.days[t0] ? 'отмечена' : 'нет') + ')').join('; ') || 'нет') + '.');
    out.push('Последние заметки: ' + (S.notes.filter((n) => !n.archived).slice(0, 8).map((n) => n.text.slice(0, 120)).join(' | ') || 'нет') + '.');
    return out.join('\n').slice(0, 7800);
  }

  // ответ ии приходит с markdown: рисуем жирный, курсив, код, списки и заголовки без innerHTML
  function mdInline(text, into) {
    text.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`)/).forEach((part) => {
      if (!part) return;
      if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) into.append(h('strong', { text: part.slice(2, -2) }));
      else if (/^\*[^*]+\*$/.test(part)) into.append(h('em', { text: part.slice(1, -1) }));
      else if (/^`[^`]+`$/.test(part)) into.append(h('code', { text: part.slice(1, -1) }));
      else into.append(part);
    });
    return into;
  }
  function mdBlock(text) {
    const root = h('div', { class: 'md' });
    let list = null, ordered = false;
    String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      const line = raw.trim();
      const li = /^(?:[-*•]\s+|(\d+)[.)]\s+)(.*)$/.exec(line);
      if (li) {
        const ord = !!li[1];
        if (!list || ordered !== ord) { list = h(ord ? 'ol' : 'ul'); ordered = ord; root.append(list); }
        list.append(mdInline(li[2], h('li')));
        return;
      }
      list = null;
      if (!line) return;
      const hd = /^#{1,6}\s+(.*)$/.exec(line);
      if (hd) { root.append(mdInline(hd[1].replace(/\*\*/g, ''), h('p', { class: 'md-h' }))); return; }
      if (/^[-*_]{3,}$/.test(line)) return;
      root.append(mdInline(line, h('p')));
    });
    return root;
  }

  let askLog = [];
  const ASK_HINTS = ['что у меня на сегодня?', 'сколько я потратил за неделю?', 'что я ел сегодня и сколько осталось ккал?', 'какие привычки я пропускаю?'];

  // текст ответа проявляется слово за словом, как при печати: каждое слово плавно выходит из размытия
  function streamWords(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const total = nodes.reduce((n, t) => n + (t.nodeValue.match(/\S+/g) || []).length, 0);
    const step = Math.min(0.05, 4 / Math.max(total, 1));
    let n = 0;
    nodes.forEach((t) => {
      const frag = document.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement('span');
        w.className = 'w'; w.textContent = part; w.style.animationDelay = (0.1 + n++ * step).toFixed(2) + 's';
        frag.appendChild(w);
      });
      t.replaceWith(frag);
    });
  }

  function pAsk() {
    const root = h('div', { class: 'stack' });
    root.append(D.mark('ASK'));
    if (!D.aiOn()) { root.append(h('p', { class: 'mark-cap', text: 'ИИ пока не подключён: нужен адрес воркера в config.js.' })); return root; }
    const box = h('div', { class: 'chat' });
    const input = h('input', { class: 'field', placeholder: 'Спроси свою жизнь…', maxlength: '300', enterkeyhint: 'send', 'aria-label': 'вопрос' });
    const send = h('button', { class: 'ib go', type: 'button', 'aria-label': 'спросить', onclick: () => ask(input.value) }, icon('plus'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(input.value); } });
    // обычный чат: свои сообщения пузырьком справа, ответ ии просто текстом без рамки
    const draw = () => {
      box.replaceChildren();
      askLog.forEach((m) => {
        const fresh = m.fresh; m.fresh = false;
        let el;
        if (m.me) el = h('div', { class: 'msg me' }, h('p', { text: m.t }));
        else if (m.wait) el = h('div', { class: 'msg ai thinking', role: 'status' }, D.logo('logo think'), h('span', { text: 'думаю…' }));
        else {
          el = h('div', { class: 'msg ai' }, mdBlock(m.t));
          if (fresh) { streamWords(el); if (m.t.length > 500) el.classList.add('plain'); }
        }
        if (fresh && m.me) el.classList.add('rise');
        box.append(el);
      });
      if (askLog.length) requestAnimationFrame(() => { const last = box.lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    };
    let busy = false;
    const setAnswer = (t) => { const m = askLog[askLog.length - 1]; m.t = t; m.wait = false; m.fresh = true; };
    const ask = (q) => {
      q = String(q || '').trim();
      if (!q || busy) return;
      busy = true; input.value = ''; if (chips) chips.remove();
      askLog.push({ me: true, t: q, fresh: true }); askLog.push({ me: false, t: '', wait: true, fresh: true }); draw();
      D.aiCall({ mode: 'ask', question: q, context: lifeContext() }).then((r) => { setAnswer(r.answer || 'пустой ответ'); })
        .catch((e) => { setAnswer(e.message === 'limit' ? 'лимит запросов на сегодня исчерпан' : 'не получилось ответить (' + e.message + (/failed to fetch|load failed|networkerror/i.test(e.message) ? ', сайт ' + location.origin : '') + ')'); })
        .then(() => { busy = false; draw(); });
    };
    root.append(h('p', { class: 'cap', style: 'margin:0 6px', text: 'Для ответа задачи, траты, еда и последние заметки отправляются на сервер ИИ. Остальное хранится только на телефоне.' }));
    const chips = !askLog.length ? h('div', { class: 'chips scroll' }, ASK_HINTS.map((q) => h('button', { class: 'chip', type: 'button', text: q, onclick: () => ask(q) }))) : null;
    if (chips) root.append(chips);
    root.append(box);
    root.append(h('div', { class: 'composer' }, card('cap-in', input, send)));
    draw();
    return root;
  }

  /* ================= меню ================= */

  function pMenu() {
    const S = D.S;
    const rows = [
      ['calendar', 'Календарь', 'дни, недели, месяцы'],
      ['focus', 'Focus Mode', S.focus.active ? 'идёт фокус' : 'таймер 25, 45, 60 минут'],
      ['lists', 'Умные списки', 'покупки, желания, книги, фильмы'],
      ['stats', 'Статистика', 'задачи, деньги, фокус, привычки'],
      ['timeline', 'Timeline', 'лента событий по дням'],
      D.aiOn() ? ['ask', 'Спроси ИИ', 'вопросы по твоим данным'] : null,
      ['search', 'Поиск', 'по всем записям'],
      ['reset', 'Daily Reset', 'разобрать хвосты дня'],
      ['archive', 'Архив', 'выполненное и старые заметки'],
      ['pro', 'DDX Pro', D.isPro() ? 'активна до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') : 'бесплатный тариф'],
      ['subscriptions', 'Тарифы', fmt(C.price.month) + ' ₸ в месяц'],
      ['pay', 'Оплата', 'kaspi и код активации'],
      ['prefs', 'Профиль и цели', 'имя, цели, уведомления, копия данных'],
      ['support', 'Поддержка', 'написать нам'],
      ['legal', 'Документы', 'конфиденциальность и условия']
    ].filter(Boolean);
    const root = h('div', { class: 'stack' });
    root.append(D.mark('SETTINGS'));
    rows.forEach((r, i) => root.append(tapCard('menu-row', () => go(r[0]),
      h('span', { class: 'n', text: D.pad(i + 1) }),
      h('div', null, h('p', { class: 'item-title', text: r[1] }), h('p', { class: 'item-meta', text: r[2] })),
      h('span', { class: 'arrow' }, icon('right')))));
    root.append(h('p', { class: 'foot', text: 'Создано @bauyrzhanov_12_' }));
    return root;
  }

  /* ================= pro, тарифы, оплата ================= */

  function pPro() {
    const S = D.S, root = h('div', { class: 'stack' });
    root.append(card('dots', label('статус'),
      h('p', { class: 'num', text: D.isPro() ? 'Pro' : 'Free' }),
      h('p', { class: 'cap', text: D.isPro() ? 'Подписка действует до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') + '. Все ограничения сняты.' : 'Бесплатный тариф с лимитами. Pro снимает все ограничения приложения.' })));
    root.append(card('', label('что даёт pro'), h('ul', { class: 'plan' },
      ['Голос без лимитов: записи любой длины, сколько угодно в день', 'Безлимит на заметки, задачи, категории, подзадачи и повторы',
        'Сколько угодно напоминаний, умных списков и привычек', 'Focus Mode без ограничения сессий', 'Финансы без лимита записей',
        'Статистика за 30 и 90 дней, полная история в Timeline', 'Архив без ограничения размера'].map((t) => h('li', { text: t })))));
    root.append(h('div', { class: 'line' },
      h('button', { class: 'btn solid', style: 'flex:1', type: 'button', text: 'тарифы', onclick: () => go('subscriptions') }),
      h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'ввести код', onclick: () => go('pay') })));
    return root;
  }

  function pSubs() {
    const root = h('div', { class: 'stack' });
    const yearFull = C.price.month * 12;
    const off = Math.round((1 - C.price.year / yearFull) * 100);
    root.append(card('', label('бесплатно'), h('p', { class: 'num sm' }, '0', h('small', { text: '₸' })), h('ul', { class: 'plan' }, C.freePlan.map((f) => h('li', { text: f })))));
    root.append(card('dots', label('pro на месяц'), h('p', { class: 'num sm' }, fmt(C.price.month), h('small', { text: '₸ в месяц' })), h('p', { class: 'cap', text: 'Как стакан кофе. Все ограничения сняты.' })));
    root.append(card('dots', h('div', { class: 'tile-head' }, label('pro на год'), h('span', { class: 'tag hot', text: '−' + off + '%' })),
      h('p', { class: 'num sm' }, fmt(C.price.year), h('small', { text: '₸ в год' })),
      h('p', { class: 'cap', text: 'Это ' + fmt(C.price.year / 12) + ' ₸ в месяц вместо ' + fmt(C.price.month) + '. Экономия ' + fmt(yearFull - C.price.year) + ' ₸.' })));
    root.append(h('button', { class: 'btn solid block', type: 'button', text: 'как оплатить', onclick: () => go('pay') }));
    return root;
  }

  let payPlan = 'month';
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function pPay() {
    const S = D.S, root = h('div', { class: 'stack' });
    const amountEl = h('p', { class: 'num sm' });
    const setAmount = () => amountEl.replaceChildren(fmt(C.price[payPlan]), h('small', { text: '₸' }));
    setAmount();
    const k = C.kaspi || {};
    root.append(card('dots', label('перевод на kaspi'),
      h('div', { style: 'margin-top:10px' }, chips([['month', 'месяц'], ['year', 'год']], payPlan, (x) => { payPlan = x; setAmount(); })),
      amountEl,
      k.card ? h('div', { style: 'margin-top:8px' }, h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'карта' }), h('button', { class: 'link ink', style: 'min-height:0;padding:0', type: 'button', text: k.card, onclick: () => { if (navigator.clipboard) navigator.clipboard.writeText(k.card.replace(/\s/g, '')).then(() => toast('номер скопирован')); } })),
        k.holder ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'получатель' }), h('span', { text: k.holder })) : null)
        : h('p', { class: 'cap', text: 'Реквизиты для перевода пришлём в поддержке.' })));
    root.append(card('', label('как это работает'),
      h('ol', { class: 'steps' }, h('li', { text: 'Переведи сумму тарифа.' }), h('li', { text: 'Отправь чек в поддержку.' }), h('li', { text: 'Получи код активации и введи его ниже.' })),
      h('a', { class: 'btn block', style: 'margin-top:14px', href: 'https://t.me/' + C.support.handle, target: '_blank', rel: 'noopener', text: 'написать в поддержку' })));
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
      save(); toast('pro активирован'); refresh();
    };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); activate(); } });
    root.append(card('', label('код активации'),
      D.isPro() ? h('p', { class: 'cap', text: 'Pro действует до ' + new Date(S.pro.until).toLocaleDateString('ru-RU') + '. Новый код продлит подписку.' }) : null,
      h('div', { class: 'line', style: 'margin-top:12px' }, code, h('button', { class: 'btn solid', type: 'button', text: 'активировать', onclick: activate })), msg));
    return root;
  }

  /* ================= настройки ================= */

  function pSettings() {
    const S = D.S, root = h('div', { class: 'stack' });
    const nameIn = h('input', { class: 'field', value: S.name, placeholder: 'твоё имя', maxlength: '24', autocomplete: 'given-name', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'имя' });
    const saveName = () => {
      const n = L.cleanName(nameIn.value);
      if (!n) { toast('введи имя'); nameIn.focus(); return; }
      S.name = n; save(); toast('имя сохранено'); refresh();
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
    root.append(card('', label('имя'), h('p', { class: 'cap', text: 'Так приложение здоровается с тобой на главной.' }),
      h('div', { class: 'line', style: 'margin-top:12px' }, nameIn, h('button', { class: 'btn solid', type: 'button', text: 'сохранить', onclick: saveName }))));

    const water = h('input', { class: 'field', type: 'number', inputmode: 'numeric', value: S.goals.water, 'aria-label': 'цель по воде, мл' });
    const kcal = h('input', { class: 'field', type: 'number', inputmode: 'numeric', value: S.goals.kcal, 'aria-label': 'цель по калориям' });
    root.append(card('', label('цели на день'),
      h('div', { class: 'grid', style: 'margin-top:12px' }, h('div', null, h('p', { class: 'cap', style: 'margin:0 0 6px', text: 'вода, мл' }), water), h('div', null, h('p', { class: 'cap', style: 'margin:0 0 6px', text: 'калории' }), kcal)),
      h('button', { class: 'btn block', style: 'margin-top:8px', type: 'button', text: 'сохранить цели', onclick: () => {
        S.goals.water = Math.max(250, Number(water.value) || 2500); S.goals.kcal = Math.max(500, Number(kcal.value) || 2000); save(); toast('цели сохранены');
      } })));

    // уведомления
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const pushReady = D.pushSupported();
    const pushNow = D.pushOn();
    const fail = (err) => toast(err.message === 'denied' ? 'уведомления запрещены в настройках телефона' : err.message === 'unsupported' ? 'открой приложение с экрана «Домой»' : 'не получилось: ' + err.message);
    let notif;
    if (pushReady) {
      notif = card('', label('напоминания и уведомления'),
        h('p', { class: 'cap', text: pushNow ? 'Пуши включены: напоминание придёт на телефон, даже когда приложение закрыто.' :
          perm === 'denied' ? 'Уведомления запрещены в настройках телефона. Разреши их там и вернись сюда.' : 'Включи пуши, и напоминания будут приходить на телефон при закрытом приложении, как сообщения.' }),
        pushNow ? h('div', { class: 'line', style: 'margin-top:12px' },
          h('button', { class: 'btn block', style: 'flex:1', type: 'button', text: 'проверить пуш', onclick: () => { D.pushTest().then(() => toast('пуш отправлен, он придёт через пару секунд')).catch(fail); } }),
          h('button', { class: 'btn block', style: 'flex:1', type: 'button', text: 'выключить', onclick: () => { D.pushOff().then(() => refresh()); } })) :
          h('button', { class: 'btn solid block', style: 'margin-top:12px', type: 'button', text: 'включить пуш-уведомления', onclick: () => { D.pushEnable().then(() => { toast('пуши включены'); refresh(); }).catch(fail); } }));
    } else {
      notif = card('', label('напоминания и уведомления'),
        h('p', { class: 'cap', text: perm === 'granted' ? 'Уведомления включены. Они приходят, пока приложение открыто или недавно свёрнуто.' :
          perm === 'denied' ? 'Уведомления запрещены в настройках телефона.' :
            perm === 'unsupported' ? 'В этом режиме браузер не даёт уведомления. На iPhone добавь приложение на экран «Домой» (iOS 16.4 и новее).' : 'Разреши уведомления, чтобы напоминания и конец фокуса приходили системно.' }),
        h('p', { class: 'cap', text: 'Чтобы напоминание точно сработало при закрытом приложении, открой задачу и нажми «в календарь iphone».' }),
        perm === 'default' ? h('button', { class: 'btn solid block', style: 'margin-top:12px', type: 'button', text: 'разрешить уведомления', onclick: () => { Notification.requestPermission().then(() => refresh()); } }) : null,
        perm === 'granted' ? h('button', { class: 'btn block', style: 'margin-top:12px', type: 'button', text: 'проверить', onclick: () => D.notify('DDX Planner', 'Уведомления работают', 'test') }) : null);
    }
    root.append(notif);

    // копия данных
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.notes)) throw new Error('bad');
          D.ask('заменить данные?', 'Всё на этом телефоне заменится данными из файла. Подписка Pro сохранится.', 'заменить', () => {
            const keep = D.S.pro; const b = D.blank();
            Object.keys(b).forEach((k) => { if (data[k] != null) b[k] = data[k]; });
            b.pro = keep; D.S = b; save(); toast('данные восстановлены'); refresh();
          });
        } catch (err) { toast('это не файл копии ddx planner'); }
      };
      r.readAsText(f);
    } });
    root.append(card('', label('копия данных'),
      h('p', { class: 'cap', text: 'Все данные хранятся только на этом телефоне. Сохраняй копию, чтобы ничего не потерять и перенести на другое устройство.' }),
      h('div', { class: 'form', style: 'margin-top:12px' },
        h('button', { class: 'btn solid block', type: 'button', text: 'сохранить копию в файл', onclick: () => {
          const data = Object.assign({}, D.S, { pro: undefined, usage: undefined });
          const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { href: url, download: 'ddx-planner-' + today() + '.json' });
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        } }),
        h('button', { class: 'btn block', type: 'button', text: 'восстановить из файла', onclick: () => file.click() }),
        file)));

    const rows = [['активных задач', D.activeTasks().length], ['выполненных задач', S.tasks.filter((t) => t.done).length], ['заметок', S.notes.length], ['категорий', S.cats.length],
      ['списков', S.lists.length], ['привычек', S.habits.length], ['записей еды', S.meals.length], ['записей денег', S.money.length]];
    root.append(card('', label('на этом телефоне'), h('div', { style: 'margin-top:8px' }, rows.map((r) => h('div', { class: 'kv' }, h('span', { text: r[0] }), h('span', { class: 'muted', text: String(r[1]) }))))));
    root.append(h('button', { class: 'btn block', type: 'button', text: 'стереть все данные', onclick: () => D.ask('стереть всё?', 'Задачи, заметки, списки, привычки, еда и деньги удалятся. Имя и Pro сохранятся.', 'стереть', () => {
      const keep = { pro: D.S.pro, name: D.S.name }; D.S = D.blank(); D.S.pro = keep.pro; D.S.name = keep.name; save(); toast('данные стёрты'); refresh();
    }) }));
    root.append(h('p', { class: 'foot', text: 'DDX Planner 2.0. Создано @bauyrzhanov_12_' }));
    return root;
  }

  /* ================= архив, поддержка, документы ================= */

  let archFilter = 'all';
  function pArchive() {
    const S = D.S, root = h('div', { class: 'stack' });
    root.append(chips([['all', 'всё'], ['task', 'задачи'], ['note', 'заметки']], archFilter, (k) => { archFilter = k; refresh(); }));
    const items = []
      .concat(S.tasks.filter((t) => t.done).map((t) => ({ kind: 'task', ref: t, ts: t.doneAt || 0, title: t.title })))
      .concat(S.notes.filter((n) => n.archived).map((n) => ({ kind: 'note', ref: n, ts: n.archivedAt || n.t, title: n.text })))
      .filter((x) => archFilter === 'all' || x.kind === archFilter)
      .sort((a, b) => b.ts - a.ts);
    const max = D.lim('archive');
    const shown = items.slice(0, max);
    if (!items.length) { root.append(empty('архив пуст', 'Сюда попадают выполненные задачи и заметки, которые ты убрал в архив.')); return root; }
    if (items.length > shown.length) root.append(label('показаны последние ' + max + ' из ' + items.length + '. pro хранит всё', 'tiny'));
    root.append(card('', shown.map((it) => h('div', { class: 'item' },
      h('div', { class: 'item-body' }, h('p', { class: 'item-title clamp', style: '-webkit-line-clamp:2', text: it.title }), h('p', { class: 'item-meta', text: (it.kind === 'task' ? 'задача' : 'заметка') + ' · ' + D.stampOf(it.ts) })),
      h('button', { class: 'link', type: 'button', text: 'вернуть', onclick: () => { if (it.kind === 'task') D.toggleTask(it.ref); else { it.ref.archived = false; save(); } refresh(); } }),
      h('button', { class: 'link', type: 'button', 'aria-label': 'удалить навсегда', onclick: () => {
        if (it.kind === 'task') D.S.tasks = D.S.tasks.filter((x) => x !== it.ref); else D.S.notes = D.S.notes.filter((x) => x !== it.ref);
        save(); refresh();
      } }, '×')))));
    return root;
  }

  function pSupport() {
    const root = h('div', { class: 'stack' });
    root.append(card('dots', label('написать нам'),
      h('p', { class: 'lead', text: '@' + C.support.handle }),
      h('p', { class: 'cap', text: 'Вопросы по приложению, оплате и кодам активации.' }),
      h('a', { class: 'btn solid block', style: 'margin-top:14px', href: 'https://t.me/' + C.support.handle, target: '_blank', rel: 'noopener', text: 'открыть telegram' })));
    const qa = [
      ['Не работает запись голосом', 'Распознавание речи лучше работает в Safari. В приложении с экрана «Домой» iOS иногда его блокирует. Тогда нажми на микрофон на клавиатуре в поле ввода, текст разберётся так же.'],
      ['Что можно сказать', '«Напомни завтра в 9 утра позвонить врачу», «встреча с Асетом в пятницу в 15:00», «потратил 2500 на такси», «добавь в покупки молоко и хлеб», «съел плов 300 грамм», «выпил стакан воды», «запиши в категорию работа: …», «зарядка по будням».'],
      ['Напоминание не пришло', 'На iPhone пуши работают только у приложения, добавленного на экран «Домой» (iOS 16.4 и новее). Включи их в настройках: «включить пуш-уведомления». Если пуши недоступны, нажми в задаче «в календарь iphone», и сработает системное напоминание.'],
      ['Пропали данные', 'Данные хранятся на телефоне. Если удалить приложение с экрана «Домой» или очистить данные Safari, они исчезнут. Сохраняй копию в настройках.']
    ];
    root.append(card('', label('частые вопросы'), qa.map((x, i) => h('div', { style: i ? 'margin-top:16px' : 'margin-top:10px' }, h('p', { class: 'item-title', style: 'font-weight:600', text: x[0] }), h('p', { class: 'cap', text: x[1] })))));
    return root;
  }

  function pLegal() {
    const root = h('div', { class: 'stack' });
    if (D.aiOn()) root.append(card('', label('ии'), h('p', { class: 'cap ink', text: 'Если пользоваться ИИ, фото еды или сводка твоих данных (задачи, траты, еда, последние заметки) отправляется через наш сервер в сервис Groq. Мы ничего не храним. Остальное остаётся на телефоне.' })));
    root.append(card('', label('конфиденциальность'),
      h('p', { class: 'cap ink', text: 'Задачи, заметки, списки, привычки, записи еды и расходов хранятся только на твоём телефоне. Мы не отправляем их на сервер и не видим их.' }),
      h('p', { class: 'cap ink', text: 'При голосовом вводе речь распознаёт сервис твоего браузера (Safari использует сервис Apple). Это происходит вне приложения.' })));
    root.append(card('', label('условия'),
      h('p', { class: 'cap ink', text: 'Приложение предоставляется как есть. Подписка Pro даёт доступ ко всем функциям на срок, оплаченный кодом активации. Код действует на устройствах, где его ввели.' }),
      h('p', { class: 'cap', text: 'Черновик. Перед публичным запуском проверь тексты у юриста.' })));
    return root;
  }

  D.page('calendar', 'Календарь', pCalendar, 'tasks');
  D.page('focus', 'Focus Mode', pFocus, 'tasks');
  D.page('reset', 'Daily Reset', pReset, 'tasks');
  D.page('habits', 'Привычки', pHabits, 'digest');
  D.page('lists', 'Умные списки', pLists, 'notes');
  D.page('list', (id) => { const l = D.S.lists.find((x) => x.id === id); return l ? l.name : 'Список'; }, pList, 'lists');
  D.page('stats', 'Статистика', pStats, 'digest');
  D.page('timeline', 'Timeline', pTimeline, 'digest');
  D.page('search', 'Поиск', pSearch, 'digest');
  D.page('ask', 'Спроси ИИ', pAsk, 'digest');
  D.page('settings', 'Настройки', pMenu, 'digest');
  D.page('pro', 'DDX Pro', pPro, 'settings');
  D.page('subscriptions', 'Тарифы', pSubs, 'pro');
  D.page('pay', 'Оплата', pPay, 'subscriptions');
  D.page('prefs', 'Профиль и цели', pSettings, 'settings');
  D.page('archive', 'Архив', pArchive, 'settings');
  D.page('support', 'Поддержка', pSupport, 'settings');
  D.page('legal', 'Документы', pLegal, 'settings');
})();
