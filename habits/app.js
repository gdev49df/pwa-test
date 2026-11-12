'use strict';

const KEY = 'habits-v1';
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAYS_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* ---------- логика (без dom, чтобы её можно было проверить) ---------- */

function pad(n) { return String(n).padStart(2, '0'); }

// дата в локальном часовом поясе, формат гггг-мм-дд
function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

// серия: сколько дней подряд отмечено, считая от сегодня;
// если сегодня ещё не отмечено, серия не обрывается и считается от вчера
function streak(days, today) {
  const set = new Set(days);
  let d = today;
  if (!set.has(dkey(d))) d = addDays(d, -1);
  let n = 0;
  while (set.has(dkey(d))) { n++; d = addDays(d, -1); }
  return n;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function toggleDay(habit, key) {
  const i = habit.days.indexOf(key);
  if (i === -1) habit.days.push(key); else habit.days.splice(i, 1);
}

if (typeof module !== 'undefined') {
  module.exports = { dkey, addDays, streak, plural, toggleDay };
}

/* ---------- хранилище ---------- */

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}

function save(habits) {
  try { localStorage.setItem(KEY, JSON.stringify(habits)); } catch (e) { /* приватный режим */ }
}

/* ---------- интерфейс ---------- */

if (typeof document !== 'undefined') {
  let habits = load();
  let editing = false;

  const $list = document.getElementById('list');
  const $date = document.getElementById('date');
  const $weekday = document.getElementById('weekday');
  const $progress = document.getElementById('progress');
  const $bar = document.getElementById('bar');
  const $edit = document.getElementById('edit');
  const $form = document.getElementById('form');
  const $input = document.getElementById('input');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    const today = new Date();
    const todayKey = dkey(today);

    $date.textContent = today.getDate() + ' ' + MONTHS[today.getMonth()];
    $weekday.textContent = WEEKDAYS_LONG[today.getDay()];

    // прогресс за сегодня
    const done = habits.filter((h) => h.days.includes(todayKey)).length;
    $progress.textContent = habits.length
      ? 'сегодня ' + done + ' из ' + habits.length
      : 'пока пусто';
    $bar.textContent = '';
    habits.forEach((h) => {
      const seg = el('span', h.days.includes(todayKey) ? 'seg on' : 'seg');
      $bar.appendChild(seg);
    });

    $edit.hidden = habits.length === 0;
    $edit.textContent = editing ? 'готово' : 'изменить';
    document.body.classList.toggle('editing', editing);

    // список
    $list.textContent = '';

    if (!habits.length) {
      const empty = el('li', 'empty');
      empty.appendChild(el('p', 'empty-title', 'добавь первую привычку'));
      empty.appendChild(el('p', 'empty-hint', 'например, «выпить воды» или «10 минут чтения». отмечай её каждый день, и считаться будут дни подряд.'));
      $list.appendChild(empty);
      return;
    }

    habits.forEach((habit) => {
      const row = el('li', 'habit');

      const head = el('div', 'habit-head');
      head.appendChild(el('h2', 'habit-name', habit.name));

      const s = streak(habit.days, today);
      const sBox = el('p', s ? 'streak' : 'streak zero');
      sBox.appendChild(el('span', 'streak-n', String(s)));
      sBox.appendChild(el('span', 'streak-l', plural(s, 'день', 'дня', 'дней') + ' подряд'));
      head.appendChild(sBox);
      row.appendChild(head);

      // неделя: шесть прошлых дней и сегодня
      const week = el('div', 'week');
      for (let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        const key = dkey(d);
        const on = habit.days.includes(key);
        const isToday = i === 0;

        const cell = el('div', 'cell');
        const btn = el('button', 'dot' + (on ? ' on' : '') + (isToday ? ' today' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label',
          habit.name + ', ' + WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] +
          (on ? ': отмечено' : ': не отмечено'));
        btn.addEventListener('click', () => {
          toggleDay(habit, key);
          save(habits);
          render();
          // короткий «штамп» на только что отмеченной ячейке
          if (habit.days.includes(key)) {
            const idx = habits.indexOf(habit);
            const fresh = $list.children[idx] && $list.children[idx].querySelectorAll('.dot')[6 - i];
            if (fresh) fresh.classList.add('stamped');
          }
        });
        cell.appendChild(btn);
        cell.appendChild(el('span', isToday ? 'dl today' : 'dl', isToday ? 'сегодня' : WEEKDAYS[d.getDay()]));
        week.appendChild(cell);
      }
      row.appendChild(week);

      // удаление, видно только в режиме «изменить»
      const del = el('button', 'del', 'удалить');
      del.type = 'button';
      del.addEventListener('click', () => {
        if (confirm('Удалить «' + habit.name + '» вместе с историей?')) {
          habits = habits.filter((h) => h !== habit);
          if (!habits.length) editing = false;
          save(habits);
          render();
        }
      });
      row.appendChild(del);

      $list.appendChild(row);
    });
  }

  $form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $input.value.trim().slice(0, 60);
    if (!name) return;
    habits.push({ id: Date.now().toString(36), name: name, days: [] });
    save(habits);
    $input.value = '';
    render();
  });

  $edit.addEventListener('click', () => { editing = !editing; render(); });

  // если приложение открыли после полуночи, обновить «сегодня»
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();
}
