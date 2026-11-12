'use strict';

const KEY = 'voice-notes-v1';
const LANG_KEY = 'voice-notes-lang';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* ---------- логика (без dom, чтобы её можно было проверить) ---------- */

function pad(n) { return String(n).padStart(2, '0'); }

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// подпись времени заметки: «сегодня, 15:40», «вчера, 09:05», «9 ноября, 18:20»
function stamp(ts, now) {
  const d = new Date(ts);
  const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, now)) return 'сегодня, ' + time;
  if (sameDay(d, yesterday)) return 'вчера, ' + time;
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + time;
}

// результаты распознавания -> окончательный и промежуточный текст
function collect(results) {
  let final = '', interim = '';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = (r && r[0] && r[0].transcript) || '';
    if (r.isFinal) final += t; else interim += t;
  }
  return { final: final, interim: interim };
}

// склеить, убрать лишние пробелы, начать с заглавной буквы
function clean(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function fmtTimer(sec) { return Math.floor(sec / 60) + ':' + pad(sec % 60); }

if (typeof module !== 'undefined') {
  module.exports = { stamp, collect, clean, fmtTimer };
}

/* ---------- хранилище ---------- */

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}

function save(notes) {
  try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { /* приватный режим */ }
}

function loadLang() {
  try { return localStorage.getItem(LANG_KEY) === 'en-US' ? 'en-US' : 'ru-RU'; } catch (e) { return 'ru-RU'; }
}

/* ---------- интерфейс ---------- */

if (typeof document !== 'undefined') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  let notes = load();
  let lang = loadLang();
  let rec = null;
  let listening = false;
  let cur = { final: '', interim: '' };
  let lastError = '';
  let startedAt = 0;
  let timer = null;
  let editingId = null;
  let typing = false;

  const $count = document.getElementById('count');
  const $list = document.getElementById('list');
  const $hint = document.getElementById('hint');
  const $live = document.getElementById('live');
  const $liveTime = document.getElementById('live-time');
  const $liveText = document.getElementById('live-text');
  const $mic = document.getElementById('mic');
  const $lang = document.getElementById('lang');
  const $type = document.getElementById('type');
  const $sheet = document.getElementById('sheet');
  const $area = document.getElementById('area');
  const $saveTyped = document.getElementById('save-typed');
  const $cancelTyped = document.getElementById('cancel-typed');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function showHint(text) {
    $hint.textContent = text || '';
    $hint.hidden = !text;
  }

  const MSG = {
    unsupported: 'Распознавание речи здесь недоступно. Открой страницу в Safari или нажми «текстом» и продиктуй через микрофон на клавиатуре.',
    denied: standalone
      ? 'В приложении с экрана «Домой» iOS часто блокирует распознавание речи. Открой страницу в Safari или нажми «текстом» и продиктуй через микрофон на клавиатуре.'
      : 'Нет доступа к микрофону или к распознаванию речи. Разреши микрофон для этого сайта в настройках Safari и включи «Диктовка» в настройках клавиатуры.',
    network: 'Нет связи с сервисом распознавания. Речь распознаётся на сервере, нужен интернет.',
    silent: 'Речи не слышно. Попробуй ещё раз, ближе к микрофону.'
  };

  /* --- запись --- */

  function renderLive() {
    $liveText.textContent = '';
    if (cur.final) $liveText.appendChild(el('span', 'fin', cur.final));
    if (cur.interim) $liveText.appendChild(el('span', 'int', cur.interim));
    if (!cur.final && !cur.interim) $liveText.appendChild(el('span', 'int', 'говори, я слушаю'));
  }

  function setListening(on) {
    listening = on;
    $mic.classList.toggle('rec', on);
    $mic.setAttribute('aria-pressed', on ? 'true' : 'false');
    $mic.setAttribute('aria-label', on ? 'остановить запись' : 'начать запись');
    $live.hidden = !on;
    document.body.classList.toggle('listening', on);
  }

  function startRec() {
    if (!SR) { showHint(MSG.unsupported); return; }
    showHint('');
    lastError = '';
    cur = { final: '', interim: '' };
    try {
      rec = new SR();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => { cur = collect(e.results); renderLive(); };
      rec.onerror = (e) => { lastError = e.error || 'error'; };
      rec.onend = finishRec;
      rec.start();
    } catch (err) {
      showHint(MSG.unsupported);
      return;
    }
    startedAt = Date.now();
    $liveTime.textContent = '0:00';
    timer = setInterval(() => {
      $liveTime.textContent = fmtTimer(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    setListening(true);
    renderLive();
  }

  function stopRec() {
    if (rec) { try { rec.stop(); } catch (e) { finishRec(); } }
  }

  function finishRec() {
    if (!listening) return;
    clearInterval(timer);
    setListening(false);
    rec = null;
    const text = clean(cur.final + ' ' + cur.interim);
    if (text) {
      notes.unshift({ id: Date.now().toString(36), text: text, t: Date.now() });
      save(notes);
      showHint('');
    } else if (lastError === 'not-allowed' || lastError === 'service-not-allowed') {
      showHint(MSG.denied);
    } else if (lastError === 'network') {
      showHint(MSG.network);
    } else {
      showHint(MSG.silent);
    }
    cur = { final: '', interim: '' };
    render();
  }

  /* --- список --- */

  function render() {
    const now = new Date();
    $count.textContent = notes.length
      ? notes.length + ' ' + (notes.length % 10 === 1 && notes.length % 100 !== 11 ? 'заметка'
        : (notes.length % 10 >= 2 && notes.length % 10 <= 4 && (notes.length % 100 < 12 || notes.length % 100 > 14)) ? 'заметки' : 'заметок')
      : 'пока нет заметок';
    $lang.textContent = lang === 'ru-RU' ? 'рус' : 'eng';
    $lang.setAttribute('aria-label', 'язык речи: ' + (lang === 'ru-RU' ? 'русский' : 'английский') + ', нажми, чтобы сменить');

    $list.textContent = '';

    if (!notes.length) {
      const empty = el('li', 'empty');
      empty.appendChild(el('p', 'empty-title', 'нажми на микрофон и говори'));
      empty.appendChild(el('p', 'empty-hint', 'когда закончишь, нажми ещё раз, и текст сохранится как заметка. исправить ошибки распознавания можно потом.'));
      $list.appendChild(empty);
      return;
    }

    notes.forEach((note) => {
      const row = el('li', 'note');
      row.appendChild(el('p', 'stamp', stamp(note.t, now)));

      if (editingId === note.id) {
        const ta = el('textarea', 'edit-area');
        ta.value = note.text;
        ta.rows = Math.min(10, Math.max(3, Math.ceil(note.text.length / 32)));
        row.appendChild(ta);
        const actions = el('div', 'actions');
        const ok = el('button', 'act strong', 'сохранить');
        ok.type = 'button';
        ok.addEventListener('click', () => {
          const t = clean(ta.value);
          if (t) { note.text = t; save(notes); }
          editingId = null;
          render();
        });
        const no = el('button', 'act', 'отмена');
        no.type = 'button';
        no.addEventListener('click', () => { editingId = null; render(); });
        actions.appendChild(ok);
        actions.appendChild(no);
        row.appendChild(actions);
        $list.appendChild(row);
        setTimeout(() => ta.focus(), 0);
        return;
      }

      row.appendChild(el('p', 'text', note.text));

      const actions = el('div', 'actions');

      const copy = el('button', 'act', 'копировать');
      copy.type = 'button';
      copy.addEventListener('click', () => {
        const done = () => {
          copy.textContent = 'скопировано';
          setTimeout(() => { copy.textContent = 'копировать'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(note.text).then(done, () => {});
        }
      });

      const edit = el('button', 'act', 'править');
      edit.type = 'button';
      edit.addEventListener('click', () => { editingId = note.id; render(); });

      const del = el('button', 'act danger', 'удалить');
      del.type = 'button';
      del.addEventListener('click', () => {
        if (confirm('Удалить эту заметку?')) {
          notes = notes.filter((n) => n !== note);
          save(notes);
          render();
        }
      });

      actions.appendChild(copy);
      actions.appendChild(edit);
      actions.appendChild(del);
      row.appendChild(actions);
      $list.appendChild(row);
    });
  }

  /* --- ввод текстом (сюда же можно диктовать с клавиатуры) --- */

  function openSheet(on) {
    typing = on;
    $sheet.hidden = !on;
    document.body.classList.toggle('typing', on);
    if (on) { $area.value = ''; setTimeout(() => $area.focus(), 0); }
  }

  $type.addEventListener('click', () => openSheet(!typing));
  $cancelTyped.addEventListener('click', () => openSheet(false));
  $saveTyped.addEventListener('click', () => {
    const t = clean($area.value);
    if (t) {
      notes.unshift({ id: Date.now().toString(36), text: t, t: Date.now() });
      save(notes);
      showHint('');
    }
    openSheet(false);
    render();
  });

  $mic.addEventListener('click', () => { if (listening) stopRec(); else startRec(); });

  $lang.addEventListener('click', () => {
    if (listening) return;
    lang = lang === 'ru-RU' ? 'en-US' : 'ru-RU';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ничего */ }
    render();
  });

  // если приложение свернули во время записи, сохранить то, что уже распознано
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) stopRec();
    else if (!document.hidden) render();
  });

  render();
}
