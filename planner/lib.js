/* логика ddx planner без dom: даты, повторы, прогресс дня, разбор речи.
   работает и в браузере (window.DDXLib), и в node (для проверок). */
(function (root) {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  // код активации: регистр и дефисы не важны
  function normCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  // следующая дата повторяющейся задачи
  function nextDue(dueKey, repeat) {
    const d = fromKey(dueKey);
    if (repeat === 'daily') return dkey(addDays(d, 1));
    if (repeat === 'weekly') return dkey(addDays(d, 7));
    if (repeat === 'monthly') {
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      const last = new Date(y, m + 1, 0).getDate(); // последний день следующего месяца
      return dkey(new Date(y, m, Math.min(day, last)));
    }
    return dueKey;
  }

  // прогресс дня: выполненное сегодня против того, что осталось на сегодня и раньше
  function dayStats(tasks, todayKey) {
    let done = 0, open = 0;
    tasks.forEach((t) => {
      if (t.done) { if (t.doneKey === todayKey) done++; }
      else if (t.due && t.due <= todayKey) open++;
    });
    const total = done + open;
    return { done: done, open: open, total: total, pct: total ? Math.round(done / total * 100) : 0 };
  }

  /* ---------- разбор речи ----------
     \b в javascript не понимает кириллицу, поэтому границы слов задаются явно */

  const PRE = '(?:^|[^\\p{L}\\d])';
  const POST = '(?![\\p{L}\\d])';
  function re(body, flags) { return new RegExp(PRE + body + POST, flags || 'iu'); }
  function reG(body) { return new RegExp(PRE + body + POST, 'giu'); }

  const WEEKDAYS = [
    ['воскресень', 0], ['понедельник', 1], ['вторник', 2], ['сред', 3],
    ['четверг', 4], ['пятниц', 5], ['суббот', 6]
  ];

  function cap(t) { t = t.trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }

  // сумма в тенге из фразы: «500 тенге», «1 500», «5 тысяч»
  function parseAmount(text) {
    const m = text.match(/(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d+))?(?:\s*(тысяч[а-я]*|тыс(?![а-я])\.?|к(?![а-я])))?/i);
    if (!m) return null;
    let n = Number(m[1].replace(/[  ]/g, '') + (m[2] ? '.' + m[2] : ''));
    if (m[3]) n *= 1000;
    return { amount: n, match: m[0] };
  }

  // дата и время из фразы: «завтра в 9 утра», «в пятницу», «в 18:30»
  function parseWhen(text, now) {
    let rest = text, date = null, time = null, m;

    m = rest.match(re('(сегодня|завтра|послезавтра)'));
    if (m) {
      const w = m[1].toLowerCase();
      date = dkey(addDays(now, w === 'сегодня' ? 0 : w === 'завтра' ? 1 : 2));
      rest = rest.replace(m[0], ' ');
    } else {
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const r = re('(?:в\\s+)?' + WEEKDAYS[i][0] + '[а-я]*');
        const wm = rest.match(r);
        if (wm) {
          let diff = (WEEKDAYS[i][1] - now.getDay() + 7) % 7;
          if (diff === 0) diff = 7;
          date = dkey(addDays(now, diff));
          rest = rest.replace(wm[0], ' ');
          break;
        }
      }
    }

    m = rest.match(re('(?:в\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(утра|дня|вечера|ночи)')) ||
        rest.match(new RegExp(PRE + 'в\\s+(\\d{1,2})[:.](\\d{2})(?!\\d)', 'iu')) ||
        rest.match(new RegExp(PRE + 'в\\s+(\\d{1,2})(?:\\s*час[а-я]*)?(?![\\d:.\\p{L}])', 'iu'));
    if (m) {
      let hh = Number(m[1]);
      const mm = m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : 0;
      const part = (m[3] || '').toLowerCase();
      if ((part === 'вечера' || part === 'дня') && hh < 12) hh += 12;
      if (part === 'ночи' && hh === 12) hh = 0;
      if (hh <= 23 && mm <= 59) {
        time = pad(hh) + ':' + pad(mm);
        rest = rest.replace(m[0], ' ');
        if (!date) {
          const passed = hh < now.getHours() || (hh === now.getHours() && mm <= now.getMinutes());
          date = dkey(addDays(now, passed ? 1 : 0));
        }
      }
    }
    return { date: date, time: time, rest: rest.replace(/\s+/g, ' ').trim() };
  }

  const EXPENSE = re('(потратил[аи]?|купил[аи]?|заплатил[аи]?|оплатил[аи]?|расход[а-я]*|отдал[аи]?)');
  const INCOME = re('(получил[аи]?|заработал[аи]?|доход[а-я]*|зарплат[а-я]*|пришл[аои]\\s+деньги|премия)');
  const TASK_START = new RegExp('^(?:напомни(?:ть)?(?:\\s+мне)?|не\\s+забудь|не\\s+забыть|добавь\\s+задачу|создай\\s+задачу|задача|нужно|надо)' + POST + '[\\s:,\\-—]*', 'iu');
  const URGENT = reG('(срочно|срочная|срочный)');
  const IMPORTANT = reG('(важно|важная|важный)');

  function parseCapture(raw, now) {
    now = now || new Date();
    let text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) return { type: 'note', text: '' };

    // «запиши в категорию Работа: подготовить документы»
    let m = text.match(/^(?:запиши|добавь|сохрани)\s+(?:заметку\s+)?в\s+категори[юи]\s+([^:,.\-—]+?)\s*[:,\-—]\s*(.+)$/i);
    if (m) return { type: 'note', text: cap(m[2]), cat: cap(m[1].trim()) };

    const amt = parseAmount(text);
    if (amt && INCOME.test(text)) return { type: 'income', text: cap(text), amount: amt.amount };
    if (amt && EXPENSE.test(text)) return { type: 'expense', text: cap(text), amount: amt.amount };

    let pri = 0;
    if (URGENT.test(text)) { pri = 2; text = text.replace(URGENT, ' '); }
    else if (IMPORTANT.test(text)) { pri = 1; text = text.replace(IMPORTANT, ' '); }
    text = text.replace(/\s+/g, ' ').trim();

    const startsTask = TASK_START.test(text);
    const when = parseWhen(text, now);
    if (startsTask || when.date) {
      const title = when.rest.replace(TASK_START, '').replace(/^[\s:,\-—]+|[\s:,\-—]+$/g, '');
      return { type: 'task', text: cap(title || when.rest), due: when.date, time: when.time, pri: pri };
    }
    return { type: 'note', text: cap(text) };
  }

  /* ---------- приветствие и имя ---------- */

  // утро с 5:00, день с 12:00, вечер с 18:00, ночь с 23:00
  function greeting(d) {
    const h = d.getHours();
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 18) return 'Добрый день';
    if (h >= 18 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  }

  // имя: только буквы, цифры, пробел, дефис, точка и апостроф; до 24 символов; с заглавной буквы
  function cleanName(s) {
    const t = String(s || '').replace(/[^\p{L}\p{N} '’.\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    // каждая часть имени с заглавной: «анна-мария», «мария ивановна»
    return t.replace(/(^|[ \-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
  }

  const api = {
    dkey: dkey, fromKey: fromKey, addDays: addDays, monthKey: monthKey, normCode: normCode,
    nextDue: nextDue, dayStats: dayStats, parseAmount: parseAmount, parseWhen: parseWhen,
    parseCapture: parseCapture, cap: cap, greeting: greeting, cleanName: cleanName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DDXLib = api;
})(typeof window !== 'undefined' ? window : this);
