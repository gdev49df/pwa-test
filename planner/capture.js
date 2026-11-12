/* быстрый ввод: одна кнопка, голос или текст. приложение само понимает, что это, и предлагает куда сохранить */
(function () {
  'use strict';
  const D = window.DDX, L = D.L, C = D.C;
  const { h, icon, label, chips, today, tomorrow, fmt, save, toast, refresh, $ } = D;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, cur = { final: '', interim: '' }, lastError = '', startedAt = 0, timer = null, hintTimer = null;

  const EXAMPLES = [
    '«напомни завтра в 9 утра позвонить врачу»', '«встреча с Асетом в пятницу в 15:00»', '«потратил 2500 на такси»',
    '«добавь в покупки молоко и хлеб»', '«съел плов 300 грамм»', '«выпил стакан воды»', '«запиши в категорию работа: …»', '«зарядка по будням в 7 утра»'
  ];

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
    clearInterval(hintTimer);
    if (on) {
      let i = Math.floor(Math.random() * EXAMPLES.length);
      $('#live-hint').textContent = 'например: ' + EXAMPLES[i];
      hintTimer = setInterval(() => { i = (i + 1) % EXAMPLES.length; $('#live-hint').textContent = 'например: ' + EXAMPLES[i]; }, 3500);
    }
  }

  function startCapture() {
    if (!SR) { openCapture('', false); return; }
    if (!D.isPro() && D.usage().voice >= C.limits.voiceDay) { D.limitHit('voiceDay'); return; }
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
      $('#live-time').textContent = Math.floor(sec / 60) + ':' + D.pad(sec % 60);
      if (!D.isPro() && sec >= C.limits.voiceSeconds) { toast('запись остановлена: в бесплатном тарифе до 2 минут'); stopCapture(); }
    }, 500);
    setListening(true);
    renderLive();
  }

  function stopCapture() { if (rec) { try { rec.stop(); } catch (e) { finishCapture(); } } }

  function finishCapture() {
    if (!listening) return;
    clearInterval(timer);
    setListening(false);
    rec = null;
    const text = (cur.final + ' ' + cur.interim).replace(/\s+/g, ' ').trim();
    if (text) { openCapture(text, true); return; }
    if (lastError === 'not-allowed' || lastError === 'service-not-allowed') {
      toast('нет доступа к распознаванию речи, продиктуй с клавиатуры');
      openCapture('', false);
    } else if (lastError === 'network') toast('нет связи с сервисом распознавания');
    else toast('речи не слышно, попробуй ещё раз');
  }

  $('#fab').addEventListener('click', () => { if (listening) stopCapture(); else startCapture(); });
  $('#live').addEventListener('click', () => { if (listening) stopCapture(); });

  /* лист «куда сохранить» */
  const TYPES = [['note', 'заметка'], ['task', 'задача'], ['meeting', 'встреча'], ['expense', 'расход'], ['income', 'доход'], ['list', 'в список'], ['meal', 'еда'], ['water', 'вода'], ['habit', 'привычка']];

  function openCapture(text, fromVoice) {
    const ctx = () => ({ lists: D.S.lists, cats: D.S.cats });
    let p = L.parseCapture(text, new Date(), ctx());
    let type = p.type, picked = false;
    const st = {};
    const fromParse = () => {
      Object.assign(st, {
        text: p.text || text, cat: p.cat || '', due: p.due || '', time: p.time || '', pri: p.pri || 0, repeat: p.repeat || null, remind: !!p.remind,
        amount: p.amount || '', mcat: p.cat && (p.type === 'expense') ? p.cat : '', list: p.list || 'shop', kcal: p.kcal || '', ml: p.ml || 250,
        habit: ''
      });
      if (p.type === 'habit') {
        const x = D.S.habits.find((y) => y.name.toLowerCase().indexOf(String(p.text).toLowerCase().slice(0, 5)) === 0);
        st.habit = x ? x.id : '';
      }
    };
    fromParse();
    st.text = p.text || text;
    let debounce = null;

    D.openSheet((panel) => {
      const draw = (keepFocus) => {
        panel.replaceChildren();
        const ta = h('textarea', { class: 'area', rows: '3', value: st.text, placeholder: fromVoice ? '' : 'Напиши или нажми на микрофон на клавиатуре и продиктуй', 'aria-label': 'текст' });
        ta.addEventListener('input', () => {
          st.text = ta.value;
          if (picked) return;
          clearTimeout(debounce);
          debounce = setTimeout(() => {
            const sig = () => [type, st.due, st.time, st.amount, st.cat, st.remind, JSON.stringify(st.repeat), st.list, st.kcal, st.ml].join('|');
            const before = sig();
            p = L.parseCapture(ta.value, new Date(), ctx());
            const pos = ta.selectionStart;
            fromParse();
            st.text = ta.value;
            type = p.type;
            // перерисовываем только если разбор что-то поменял, чтобы не дёргать клавиатуру
            if (sig() !== before) { draw(true); const t2 = panel.querySelector('textarea'); t2.focus(); try { t2.setSelectionRange(pos, pos); } catch (e) { /* нет */ } }
          }, 450);
        });

        const fields = [];
        if (type === 'note') {
          const opts = D.S.cats.slice();
          if (st.cat && !opts.some((c) => c.toLowerCase() === st.cat.toLowerCase())) opts.push(st.cat);
          fields.push(h('select', { class: 'select', 'aria-label': 'категория', value: st.cat, onchange: (e) => { st.cat = e.target.value; } },
            h('option', { value: '', text: 'без категории' }),
            opts.map((c) => h('option', { value: c, text: D.S.cats.includes(c) ? c : c + ' (новая категория)' }))));
        } else if (type === 'task' || type === 'meeting') {
          fields.push(h('div', { class: 'line' },
            h('input', { class: 'field', type: 'date', value: st.due, 'aria-label': 'дата', onchange: (e) => { st.due = e.target.value; } }),
            h('input', { class: 'field', type: 'time', value: st.time, 'aria-label': 'время', style: 'max-width:120px', onchange: (e) => { st.time = e.target.value; } })));
          fields.push(h('div', { class: 'chips' },
            h('button', { class: 'chip' + (st.due === today() ? ' on' : ''), type: 'button', text: 'сегодня', onclick: () => { st.due = today(); draw(); } }),
            h('button', { class: 'chip' + (st.due === tomorrow() ? ' on' : ''), type: 'button', text: 'завтра', onclick: () => { st.due = tomorrow(); draw(); } }),
            h('button', { class: 'chip' + (st.remind ? ' on' : ''), type: 'button', text: st.remind ? 'напомню' : 'напомнить', onclick: () => {
              st.remind = !st.remind;
              if (st.remind && !st.due) st.due = today();
              if (st.remind && !st.time) { const n = new Date(Date.now() + 3600000); st.time = D.pad(n.getHours()) + ':00'; }
              draw();
            } }),
            st.repeat ? h('button', { class: 'chip on', type: 'button', text: L.repeatLabel(st.repeat) + '  ×', 'aria-label': 'убрать повтор', onclick: () => { st.repeat = null; draw(); } }) : null));
          if (type === 'task') fields.push(chips(D.PRI_LABEL.map((l, i) => [i, l]), st.pri, (k) => { st.pri = k; }));
        } else if (type === 'expense' || type === 'income') {
          fields.push(h('input', { class: 'field', type: 'number', inputmode: 'decimal', placeholder: 'сумма, ₸', value: st.amount, 'aria-label': 'сумма', oninput: (e) => { st.amount = e.target.value; } }));
          if (type === 'expense') fields.push(h('select', { class: 'select', 'aria-label': 'категория расхода', value: st.mcat || L.moneyCat(st.text), onchange: (e) => { st.mcat = e.target.value; } },
            L.MONEY_CAT_LIST.map((c) => h('option', { value: c, text: c }))));
        } else if (type === 'list') {
          const opts = D.S.lists.map((l) => [l.id, l.name]);
          Object.keys(D.LIST_NAMES).forEach((k) => { if (!D.S.lists.some((l) => l.kind === k)) opts.push([k, D.LIST_NAMES[k] + ' (новый)']); });
          const curId = (D.S.lists.find((l) => l.id === st.list || l.kind === st.list) || {}).id || st.list;
          fields.push(h('select', { class: 'select', 'aria-label': 'список', value: curId, onchange: (e) => { st.list = e.target.value; } }, opts.map((o) => h('option', { value: o[0], text: o[1] }))));
          fields.push(h('p', { class: 'cap', style: 'margin:0 2px', text: 'пункты: ' + L.splitItems(st.text.replace(/^(?:добавь|запиши|внеси|закинь)\s+(?:в\s+)?(?:список\s+)?[\p{L}\-]+\s*[:,\-—]?\s+/iu, '').replace(/^(?:надо\s+|нужно\s+)?купить\s+/iu, '')).join(', ') }));
        } else if (type === 'meal') {
          const e = L.estimateKcal(st.text);
          fields.push(h('div', { class: 'line' },
            h('input', { class: 'field', type: 'number', inputmode: 'numeric', placeholder: 'ккал', value: st.kcal || '', 'aria-label': 'калории', oninput: (ev) => { st.kcal = ev.target.value; } }),
            h('span', { class: 'cap', style: 'margin:0;flex:1.4', text: e.items.length ? '≈ ' + e.items.map((i) => i.name + ' ' + i.grams + ' г').join(', ') : 'впиши калории, если знаешь' })));
        } else if (type === 'water') {
          fields.push(chips([[250, '250 мл'], [330, '330'], [500, '500'], [1000, '1 л']], Number(st.ml), (k) => { st.ml = k; }));
        } else if (type === 'habit') {
          if (!D.S.habits.length) fields.push(h('p', { class: 'cap', text: 'Привычек пока нет. Сохраню как новую и отмечу сегодня.' }));
          else fields.push(h('select', { class: 'select', 'aria-label': 'привычка', value: st.habit, onchange: (e) => { st.habit = e.target.value; } },
            h('option', { value: '', text: 'новая привычка' }), D.S.habits.map((x) => h('option', { value: x.id, text: x.name }))));
        }

        panel.append(
          h('h2', { text: 'сохранить как' }),
          fromVoice ? null : label('быстрый ввод', 'tiny'),
          h('div', { style: 'margin-top:12px' }, chips(TYPES, type, (k) => { type = k; picked = true; draw(); }, 'scroll')),
          h('div', { class: 'form' }, ta, fields,
            h('div', { class: 'line' },
              h('button', { class: 'btn', style: 'flex:1', type: 'button', text: 'отмена', onclick: D.closeSheet }),
              h('button', { class: 'btn solid', style: 'flex:1.4', type: 'button', text: 'сохранить', onclick: commit })))
        );
        if (!fromVoice && !keepFocus && !st.text) setTimeout(() => { const t = panel.querySelector('textarea'); if (t) t.focus(); }, 380);
      };

      const commit = () => {
        const body = String(st.text || '').trim();
        if (!body && type !== 'water') { toast('нечего сохранять'); return; }
        let ok = false, msg = '';
        // если человек правил текст, берём чистый разбор ещё раз для дат и сумм
        if (type === 'note') {
          let cat = st.cat;
          if (cat && fromVoice && p.cat && !D.isPro() && D.usage().voiceCat >= C.limits.voiceCatDay) { toast('лимит голосового выбора категории, сохранено без категории'); cat = ''; }
          else if (cat && !D.S.cats.includes(cat)) cat = D.addCat(cat);
          ok = D.addNote(L.cap(body), cat);
          if (ok && cat && fromVoice && p.cat) D.usage().voiceCat++;
          msg = cat ? 'заметка в «' + cat + '»' : 'заметка сохранена';
        } else if (type === 'task' || type === 'meeting') {
          const q = L.parseCapture(body, new Date(), ctx());
          const title = (q.type === 'task' || q.type === 'meeting') && q.text ? q.text : L.cap(body);
          ok = D.addTask({ title: title, kind: type, due: st.due, time: st.time, pri: st.pri, repeat: st.repeat, remind: st.remind });
          msg = (type === 'meeting' ? 'встреча' : 'задача') + (ok && ok.due ? ' на ' + D.dueLabel(ok.due, ok.time) : ' добавлена');
        } else if (type === 'expense' || type === 'income') {
          const amount = Number(String(st.amount).replace(',', '.')) || (L.parseAmount(body) || {}).amount;
          if (!(amount > 0)) { toast('укажи сумму'); return; }
          const clean = L.cap(body.replace(/(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:тысяч[а-я]*|тыс\.?|к)?\s*(?:тенге|тг|₸)?/i, ' ').replace(/^(?:я\s+)?(?:потратил[аи]?|купил[аи]?|заплатил[аи]?|оплатил[аи]?|получил[аи]?|пришл[аои])\s+/iu, '').replace(/^\s*(?:на|за)\s+/iu, '').replace(/\s+(?:на|за)\s*$/iu, '').replace(/\s+/g, ' ').trim()) || (type === 'expense' ? 'Расход' : 'Доход');
          ok = D.addMoney(type === 'expense' ? 'exp' : 'inc', amount, clean, type === 'expense' ? (st.mcat || L.moneyCat(body)) : 'доход');
          msg = (type === 'expense' ? '−' : '+') + fmt(amount) + ' ₸';
        } else if (type === 'list') {
          const l = D.listFor(st.list, true);
          if (!l) return;
          const raw = body.replace(/^(?:добавь|запиши|внеси|закинь)\s+(?:в\s+)?(?:список\s+)?[\p{L}\-]+\s*[:,\-—]?\s+/iu, '').replace(/^(?:надо\s+|нужно\s+)?купить\s+/iu, '');
          const items = /^(books|movies)$/.test(l.kind) ? [L.cap(raw)] : L.splitItems(raw);
          D.addListItems(l, items);
          ok = true; msg = 'в «' + l.name + '»: ' + items.length + ' ' + D.plural(items.length, 'пункт', 'пункта', 'пунктов');
        } else if (type === 'meal') {
          const est = L.estimateKcal(body).kcal;
          ok = D.addMeal(L.cap(body.replace(/^(?:я\s+)?(?:съел[аи]?|поел[аи]?|скушал[аи]?|на\s+(?:завтрак|обед|ужин|перекус))\s*[:,\-—]?\s*/iu, '')) || L.cap(body), Number(st.kcal) || est);
          msg = 'записано в еду';
        } else if (type === 'water') {
          D.addWater(Number(st.ml) || 250); ok = true; msg = '+' + (Number(st.ml) || 250) + ' мл воды';
        } else if (type === 'habit') {
          let x = D.S.habits.find((y) => y.id === st.habit);
          if (!x) x = D.addHabit(L.cap(body.replace(/^(?:отметь|отметить|выполнил[аи]?)\s+привычк[а-я]*\s+/iu, '')));
          if (!x) return;
          D.markHabit(x, today(), true); ok = true; msg = 'привычка «' + x.name + '» отмечена';
        }
        if (ok) {
          if (fromVoice) D.usage().voice++;
          save();
          D.closeSheet();
          toast(msg);
          refresh();
        }
      };

      draw();
    });
  }
  D.openCapture = openCapture;

  /* ---------- первый запуск: как тебя зовут ---------- */

  function askName() {
    D.openSheet((panel) => {
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
        D.S.name = n; save(); D.closeSheet(); D.render(true);
        setTimeout(() => toast('нажми на круглую кнопку и скажи, что нужно не забыть'), 700);
      };
      input.addEventListener('input', update);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
      next.addEventListener('click', done);
      panel.append(
        label('ddx planner'),
        h('h2', { style: 'margin-top:6px', text: 'как тебя зовут?' }),
        h('p', { class: 'cap', text: 'Имя можно поменять потом в настройках.' }),
        h('div', { class: 'form', style: 'margin-top:14px' }, input, preview, next));
      update();
      setTimeout(() => input.focus(), 400);
    }, { locked: true });
  }

  /* ---------- запуск ---------- */

  D.buildTabs();
  $('#fab').append(icon('mic'));
  D.render(true);
  if (!D.S.name) askName();
  D.checkReminders();
  setInterval(D.checkReminders, 15000);
  // часы фокуса на главной
  setInterval(() => {
    const el = document.querySelector('[data-focus-clock]');
    if (el && D.S.focus.active) el.textContent = D.clock(D.focusLeft());
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) stopCapture();
    else if (!document.hidden) { D.checkReminders(); if ($('#sheet').hidden) refresh(); }
  });
  // если открыли по уведомлению
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.go) D.go(e.data.go); });
})();
