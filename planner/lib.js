/* логика ddx planner без dom: даты, умные повторы, разбор речи, калории, календарь.
   работает и в браузере (window.DDXLib), и в node (для проверок). */
(function (root) {
  'use strict';

  /* ---------- даты ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n, day) {
    const y = d.getFullYear(), m = d.getMonth() + n;
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day || d.getDate(), last));
  }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  // неделя начинается с понедельника
  function weekStart(d) { const w = (d.getDay() + 6) % 7; return addDays(d, -w); }
  function daysBetween(a, b) { return Math.round((fromKey(dkey(b)) - fromKey(dkey(a))) / 86400000); }
  // n-й день недели месяца; nth = -1 значит последний
  function nthWeekday(y, m, wd, nth) {
    if (nth > 0) {
      const first = new Date(y, m, 1);
      const shift = (wd - first.getDay() + 7) % 7;
      const d = new Date(y, m, 1 + shift + (nth - 1) * 7);
      return d.getMonth() === m ? d : null;
    }
    const last = new Date(y, m + 1, 0);
    return new Date(y, m, last.getDate() - ((last.getDay() - wd + 7) % 7));
  }

  // код активации: регистр и дефисы не важны
  function normCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  /* ---------- умные повторы ----------
     правило: { k: 'days', n } | { k: 'weeks', n, wd: [0..6] } | { k: 'months', n, day } | { k: 'nth', nth, wd } */

  function normRule(r) {
    if (!r) return null;
    if (typeof r === 'string') {
      if (r === 'daily') return { k: 'days', n: 1 };
      if (r === 'weekly') return { k: 'weeks', n: 1, wd: [] };
      if (r === 'monthly') return { k: 'months', n: 1, day: 0 };
      return null;
    }
    return r;
  }

  // следующая дата после dueKey
  function nextDue(dueKey, rule) {
    rule = normRule(rule);
    const d = fromKey(dueKey);
    if (!rule) return dueKey;
    if (rule.k === 'days') return dkey(addDays(d, Math.max(1, rule.n || 1)));
    if (rule.k === 'months') return dkey(addMonths(d, Math.max(1, rule.n || 1), rule.day || d.getDate()));
    if (rule.k === 'nth') {
      for (let i = 1; i <= 24; i++) {
        const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
        const c = nthWeekday(m.getFullYear(), m.getMonth(), rule.wd, rule.nth);
        if (c) return dkey(c);
      }
      return dueKey;
    }
    // weeks
    const n = Math.max(1, rule.n || 1);
    const wd = rule.wd && rule.wd.length ? rule.wd : [d.getDay()];
    const anchor = weekStart(d);
    for (let i = 1; i <= 7 * n + 7; i++) {
      const c = addDays(d, i);
      const weeks = Math.round(daysBetween(anchor, weekStart(c)) / 7);
      if (wd.includes(c.getDay()) && weeks % n === 0) return dkey(c);
    }
    return dkey(addDays(d, 7 * n));
  }

  // первая подходящая дата начиная с fromKey (включительно)
  function firstDue(rule, fromKeyStr) {
    rule = normRule(rule);
    const d = fromKey(fromKeyStr);
    if (!rule || rule.k === 'days') return fromKeyStr;
    if (rule.k === 'weeks') {
      const wd = rule.wd && rule.wd.length ? rule.wd : [d.getDay()];
      for (let i = 0; i < 7; i++) { const c = addDays(d, i); if (wd.includes(c.getDay())) return dkey(c); }
      return fromKeyStr;
    }
    if (rule.k === 'months') {
      const day = rule.day || d.getDate();
      const here = addMonths(d, 0, day);
      return dkey(here >= d ? here : addMonths(d, 1, day));
    }
    for (let i = 0; i <= 24; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
      const c = nthWeekday(m.getFullYear(), m.getMonth(), rule.wd, rule.nth);
      if (c && c >= d) return dkey(c);
    }
    return fromKeyStr;
  }

  const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  const NTH_LABEL = { 1: 'первый', 2: 'второй', 3: 'третий', 4: 'четвёртый', '-1': 'последний' };

  function plural(n, one, few, many) {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

  function repeatLabel(rule) {
    rule = normRule(rule);
    if (!rule) return '';
    const n = rule.n || 1;
    if (rule.k === 'days') return n === 1 ? 'каждый день' : n === 2 ? 'через день' : 'каждые ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
    if (rule.k === 'months') {
      const base = n === 1 ? 'каждый месяц' : 'каждые ' + n + ' ' + plural(n, 'месяц', 'месяца', 'месяцев');
      return rule.day ? base + ', ' + rule.day + ' числа' : base;
    }
    if (rule.k === 'nth') return 'каждый ' + NTH_LABEL[rule.nth] + ' ' + WD_SHORT[rule.wd] + ' месяца';
    const wd = rule.wd || [];
    const set = wd.slice().sort().join(',');
    if (n === 1 && set === '1,2,3,4,5') return 'по будням';
    if (n === 1 && set === '0,6') return 'по выходным';
    const days = wd.length ? ' по ' + wd.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => WD_SHORT[x]).join(', ') : '';
    if (n === 1) return (days ? 'каждую неделю' : 'каждую неделю') + days;
    return 'каждые ' + n + ' ' + plural(n, 'неделю', 'недели', 'недель') + days;
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
  const WD_RE = '(понедельник[а-я]*|вторник[а-я]*|сред[а-я]*|четверг[а-я]*|пятниц[а-я]*|суббот[а-я]*|воскресень[а-я]*)';
  function wdOf(word) {
    word = word.toLowerCase();
    for (let i = 0; i < WEEKDAYS.length; i++) if (word.indexOf(WEEKDAYS[i][0]) === 0) return WEEKDAYS[i][1];
    return -1;
  }
  const MONTH_STEMS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
  const MONTH_RE = '(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])';
  function monthOf(word) {
    word = word.toLowerCase();
    for (let i = MONTH_STEMS.length - 1; i >= 0; i--) if (word.indexOf(MONTH_STEMS[i]) === 0) return i;
    return -1;
  }

  const NUMW = {
    'один': 1, 'одну': 1, 'одна': 1, 'первый': 1, 'первое': 1, 'первую': 1, 'первого': 1,
    'два': 2, 'две': 2, 'второй': 2, 'второе': 2, 'вторую': 2, 'второго': 2,
    'три': 3, 'третий': 3, 'третье': 3, 'третью': 3, 'третьего': 3,
    'четыре': 4, 'четвёртый': 4, 'четвертый': 4, 'четвёртую': 4, 'четвертую': 4,
    'пять': 5, 'пятый': 5, 'пятое': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10,
    'пятнадцать': 15, 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'полчаса': 30,
    'последний': -1, 'последнюю': -1, 'последнее': -1
  };
  const NUM_RE = '(\\d{1,2}|один|одну|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|пятнадцать|двадцать|тридцать|сорок)';
  const ORD_RE = '(первый|первую|второй|вторую|третий|третью|четвёртый|четвертый|четвёртую|четвертую|последний|последнюю)';
  function numOf(w) { if (/^\d+$/.test(w)) return Number(w); return NUMW[String(w).toLowerCase()] || 0; }

  function cap(t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function tidy(t) { return String(t || '').replace(/\s+/g, ' ').replace(/^[\s:,.\-—]+|[\s:,\-—]+$/g, '').trim(); }

  // правило повтора из фразы
  function parseRepeat(text) {
    let m;
    const out = (rule, match) => ({ rule: rule, rest: tidy(text.replace(match, ' ')) });

    if ((m = text.match(re('(?:каждый|каждые|каждое)\\s+' + ORD_RE + '\\s+' + WD_RE + '\\s+месяца')))) return out({ k: 'nth', nth: numOf(m[1]), wd: wdOf(m[2]) }, m[0]);
    if ((m = text.match(re(ORD_RE + '\\s+' + WD_RE + '\\s+(?:каждого\\s+)?месяца')))) return out({ k: 'nth', nth: numOf(m[1]), wd: wdOf(m[2]) }, m[0]);
    if ((m = text.match(re('(?:каждое\\s+|по\\s+)?(\\d{1,2}|первое|второе|третье|пятое|последнее|первого|второго|третьего)(?:-?е|-?го)?\\s+числ[оа]\\s+(?:каждого\\s+)?месяца')) ||
        text.match(re('каждое\\s+(\\d{1,2}|первое|второе|третье|пятое)(?:-?е)?\\s+число')))) {
      const n = numOf(m[1]);
      return out({ k: 'months', n: 1, day: n > 0 ? n : 31 }, m[0]);
    }
    if ((m = text.match(re('(?:каждый|ежедневно)(?:\\s+день)?')) ) && /кажд[а-я]*\s+день|ежедневно/i.test(m[0])) return out({ k: 'days', n: 1 }, m[0]);
    if ((m = text.match(re('через\\s+день')))) return out({ k: 'days', n: 2 }, m[0]);
    if ((m = text.match(re('кажды[ей]\\s+' + NUM_RE + '\\s+(дня|дней|день)')))) return out({ k: 'days', n: numOf(m[1]) || 1 }, m[0]);
    if ((m = text.match(re('кажды[ей]\\s+' + NUM_RE + '\\s+(недели|недель|неделю)')))) return out({ k: 'weeks', n: numOf(m[1]) || 1, wd: [] }, m[0]);
    if ((m = text.match(re('кажды[ей]\\s+' + NUM_RE + '\\s+(месяца|месяцев|месяц)')))) return out({ k: 'months', n: numOf(m[1]) || 1, day: 0 }, m[0]);
    if ((m = text.match(re('по\\s+будням')))) return out({ k: 'weeks', n: 1, wd: [1, 2, 3, 4, 5] }, m[0]);
    if ((m = text.match(re('по\\s+выходным')))) return out({ k: 'weeks', n: 1, wd: [6, 0] }, m[0]);
    // «каждый второй понедельник», «каждый понедельник и среду», «по вторникам и четвергам»
    m = text.match(new RegExp(PRE + '(?:кажд[а-я]*\\s+(?:(второй|вторую|третий|третью|четвёртый|четвертый)\\s+)?|по\\s+)' + WD_RE + '((?:\\s*(?:,|и)\\s*' + WD_RE + ')*)' + POST, 'iu'));
    if (m) {
      const n = m[1] ? numOf(m[1]) : 1;
      const wd = [wdOf(m[2])];
      (m[3] || '').split(/\s*(?:,|\sи\s)\s*/).forEach((w) => { const x = wdOf(w.replace(/^и\s+/, '').trim()); if (x >= 0 && !wd.includes(x)) wd.push(x); });
      return out({ k: 'weeks', n: n, wd: wd }, m[0]);
    }
    if ((m = text.match(re('(каждую\\s+неделю|еженедельно)')))) return out({ k: 'weeks', n: 1, wd: [] }, m[0]);
    if ((m = text.match(re('(каждый\\s+месяц|ежемесячно)')))) return out({ k: 'months', n: 1, day: 0 }, m[0]);
    return { rule: null, rest: text };
  }

  // сумма в тенге из фразы: «500 тенге», «1 500», «5 тысяч»
  function parseAmount(text) {
    const m = text.match(/(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d+))?(?:\s*(тысяч[а-я]*|тыс(?![а-я])\.?|к(?![а-я])))?/i);
    if (!m) return null;
    let n = Number(m[1].replace(/[  ]/g, '') + (m[2] ? '.' + m[2] : ''));
    if (m[3]) n *= 1000;
    return { amount: n, match: m[0] };
  }

  // дата и время из фразы: «завтра в 9 утра», «в пятницу», «15 ноября», «через 2 часа»
  function parseWhen(text, now) {
    let rest = text, date = null, time = null, m, fromTime = false;

    // относительное время: через 30 минут / через 2 часа / через 3 дня / через неделю
    m = rest.match(re('через\\s+(?:' + NUM_RE + '\\s+)?(минут[а-я]*|час[а-я]*|полчаса|дн[а-я]*|день|недел[а-я]*|месяц[а-я]*)'));
    if (m && !/через\s+день$/i.test(m[0].trim())) {
      const n = m[1] ? numOf(m[1]) : (/полчаса/i.test(m[2]) ? 30 : 1);
      const unit = m[2].toLowerCase();
      if (/^мин|^полчаса/.test(unit)) { const t = new Date(now.getTime() + n * 60000); date = dkey(t); time = pad(t.getHours()) + ':' + pad(t.getMinutes()); }
      else if (/^час/.test(unit)) { const t = new Date(now.getTime() + n * 3600000); date = dkey(t); time = pad(t.getHours()) + ':' + pad(t.getMinutes()); }
      else if (/^д/.test(unit)) date = dkey(addDays(now, n));
      else if (/^нед/.test(unit)) date = dkey(addDays(now, 7 * n));
      else date = dkey(addMonths(now, n));
      rest = rest.replace(m[0], ' ');
    }

    if (!date) {
      m = rest.match(re('(сегодня|завтра|послезавтра)'));
      if (m) {
        const w = m[1].toLowerCase();
        date = dkey(addDays(now, w === 'сегодня' ? 0 : w === 'завтра' ? 1 : 2));
        rest = rest.replace(m[0], ' ');
      }
    }
    if (!date) {
      // «15 ноября», «1 января»
      m = rest.match(re('(\\d{1,2})(?:-?го)?\\s+' + MONTH_RE));
      if (m) {
        const day = Number(m[1]), mon = monthOf(m[2]);
        let d = new Date(now.getFullYear(), mon, day);
        if (dkey(d) < dkey(now)) d = new Date(now.getFullYear() + 1, mon, day);
        if (d.getMonth() === mon) { date = dkey(d); rest = rest.replace(m[0], ' '); }
      }
    }
    if (!date) {
      // «15.11» и «15.11.2026»
      m = rest.match(new RegExp(PRE + '(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?(?![\\d:])', 'u'));
      if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
        let y = m[3] ? Number(m[3]) : now.getFullYear();
        if (y < 100) y += 2000;
        let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
        if (!m[3] && dkey(d) < dkey(now)) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
        date = dkey(d); rest = rest.replace(m[0], ' ');
      }
    }
    if (!date) {
      for (let i = 0; i < WEEKDAYS.length; i++) {
        const r = re('(?:в\\s+|во\\s+)?' + WEEKDAYS[i][0] + '[а-я]*');
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

    if (!time) {
      m = rest.match(re('(?:в\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(утра|дня|вечера|ночи)')) ||
          rest.match(new RegExp(PRE + '(?:в|к)\\s+(\\d{1,2})[:.](\\d{2})(?!\\d)', 'iu')) ||
          rest.match(new RegExp(PRE + '(?:в|к)\\s+(\\d{1,2})(?:\\s*час[а-я]*)?(?![\\d:.\\p{L}])', 'iu')) ||
          rest.match(new RegExp(PRE + '(\\d{1,2}):(\\d{2})(?!\\d)', 'u'));
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
            fromTime = true;
          }
        }
      }
    }
    return { date: date, time: time, fromTime: fromTime, rest: rest.replace(/\s+/g, ' ').trim() };
  }

  /* ---------- категории расходов ---------- */

  const MONEY_CATS = [
    ['еда', 'продукт|еда|еду|хлеб|молок|магазин|супермаркет|кофе|обед|ужин|завтрак|кафе|ресторан|пицц|бургер|шаурм|доставк|фрукт|овощ|мяс|сыр|чай'],
    ['транспорт', 'такси|автобус|метро|бензин|заправк|парковк|яндекс\\s*го|проезд|машин|ремонт\\s+авто|шиномонтаж'],
    ['дом', 'аренд|квартир|коммунал|свет|газ|вод[аыу]\\s+за|интернет|мебел|ремонт|посуд|уборк'],
    ['связь', 'связь|телефон|мобильн|тариф|beeline|билайн|kcell|activ|tele2|алтел|altel|подписк'],
    ['здоровье', 'аптек|лекарств|врач|анализ|стоматолог|зуб|клиник|спортзал|фитнес|массаж'],
    ['развлечения', 'кино|игр|концерт|бар|клуб|подарок|подарк|отпуск|поездк|билет|steam|netflix|spotify'],
    ['одежда', 'одежд|обув|кроссовк|куртк|футболк|джинс|платье|шапк'],
    ['учёба', 'курс|книг|учеб|учёб|школ|универ|репетитор']
  ];
  function moneyCat(text) {
    const t = String(text || '').toLowerCase();
    for (let i = 0; i < MONEY_CATS.length; i++) if (new RegExp(MONEY_CATS[i][1], 'iu').test(t)) return MONEY_CATS[i][0];
    return 'другое';
  }
  const MONEY_CAT_LIST = MONEY_CATS.map((c) => c[0]).concat(['другое']);

  /* ---------- калории: ккал на 100 г и обычная порция ---------- */

  const FOODS = [
    ['плов', 'плов', 190, 300], ['бешбармак', 'бешбармак', 210, 350], ['манты', 'мант', 230, 250], ['лагман', 'лагман', 140, 400],
    ['шашлык', 'шашлык', 250, 200], ['самса', 'самс', 330, 150], ['баурсак', 'баурсак', 380, 60], ['шаурма', 'шаурм', 230, 300],
    ['борщ', 'борщ', 50, 350], ['суп', 'суп', 45, 350], ['гречка', 'гречк', 110, 200], ['рис', 'рис(?!к)', 130, 200],
    ['макароны', 'макарон|паст[аыу]', 150, 250], ['картошка', 'картош|картофел|пюре', 90, 250], ['картофель фри', 'фри', 310, 120],
    ['курица', 'куриц|курин|грудк', 165, 150], ['говядина', 'говядин', 220, 150], ['котлета', 'котлет', 230, 100],
    ['рыба', 'рыб|лосос|семг', 160, 150], ['пельмени', 'пельмен', 250, 250], ['пицца', 'пицц', 270, 250], ['бургер', 'бургер', 260, 230],
    ['салат', 'салат', 90, 200], ['омлет', 'омлет', 155, 150], ['яйцо', 'яйц|яичниц', 155, 55], ['каша', 'каш|овсян', 90, 250],
    ['творог', 'творог', 120, 150], ['йогурт', 'йогурт', 70, 150], ['кефир', 'кефир', 50, 250], ['молоко', 'молок', 60, 250],
    ['сыр', 'сыр(?!н)', 360, 30], ['хлеб', 'хлеб|бутерброд|тост', 250, 40], ['лепёшка', 'лепёшк|лепешк|нан', 280, 100],
    ['банан', 'банан', 90, 120], ['яблоко', 'яблок', 52, 180], ['апельсин', 'апельсин|мандарин', 45, 150], ['виноград', 'виноград', 70, 150],
    ['орехи', 'орех', 600, 30], ['шоколад', 'шоколад', 540, 25], ['печенье', 'печень', 450, 30], ['торт', 'торт|пирожн', 350, 120],
    ['мороженое', 'морожен', 210, 80], ['чипсы', 'чипс', 540, 50], ['кофе с молоком', 'латте|капучино|кофе\\s+с\\s+молок', 45, 300],
    ['кофе', 'кофе|американо|эспрессо', 2, 200], ['чай', 'чай', 1, 250], ['сок', 'сок', 45, 250], ['кола', 'кол[аыу]|лимонад|газировк', 42, 330],
    ['протеин', 'протеин', 380, 30], ['авокадо', 'авокадо', 160, 100], ['суши', 'суши|ролл', 150, 250]
  ];

  function estimateKcal(text) {
    const t = String(text || '').toLowerCase();
    const items = [];
    let total = 0;
    FOODS.forEach((f) => {
      const m = t.match(new RegExp('(?:(\\d{1,4})\\s*(?:г|гр|грамм[а-я]*)\\s+)?(?:(\\d{1,2}|один|одну|два|две|три|четыре|пять)\\s+)?(' + f[1] + ')[а-яё]*(?:\\s+(\\d{1,4})\\s*(?:г|гр|грамм[а-я]*|мл))?', 'iu'));
      if (!m) return;
      let grams = f[3];
      if (m[1]) grams = Number(m[1]);
      else if (m[4]) grams = Number(m[4]);
      else if (m[2]) grams = f[3] * numOf(m[2]);
      const kcal = Math.round(f[2] * grams / 100);
      items.push({ name: f[0], grams: grams, kcal: kcal });
      total += kcal;
    });
    return { kcal: total, items: items };
  }

  /* ---------- быстрый ввод: что сказал человек ---------- */

  const EXPENSE = re('(потратил[аи]?|купил[аи]?|заплатил[аи]?|оплатил[аи]?|расход[а-я]*|отдал[аи]?|потрачено)');
  const INCOME = re('(получил[аи]?|заработал[аи]?|доход[а-я]*|зарплат[а-я]*|пришл[аои]\\s+деньги|премия|аванс|кэшбэк|перевели)');
  const TASK_START = new RegExp('^(?:напомни(?:ть)?(?:\\s+мне)?|не\\s+забудь|не\\s+забыть|добавь\\s+задачу|создай\\s+задачу|задача|нужно|надо|сделать)' + POST + '[\\s:,\\-—]*', 'iu');
  const REMIND = new RegExp('^(?:напомни(?:ть)?(?:\\s+мне)?|поставь\\s+напоминание|напоминание)' + POST, 'iu');
  const MEETING = new RegExp('^(?:встреча|встретиться|созвон|созвониться|собрание|совещание|звонок)' + POST + '|' + PRE + 'встреча\\s+с' + POST, 'iu');
  const URGENT = reG('(срочно|срочная|срочный)');
  const IMPORTANT = reG('(важно|важная|важный)');

  const LIST_KINDS = [
    ['shop', 'покупки', 'покупк[а-я]*|магазин'], ['wish', 'желания', 'желани[а-я]*|вишлист'], ['books', 'книги', 'книг[а-я]*'],
    ['movies', 'фильмы', 'фильм[а-я]*|сериал[а-я]*|кино'], ['check', 'чек-лист', 'чек-?лист[а-я]*|список\\s+дел']
  ];
  function listKind(word) {
    for (let i = 0; i < LIST_KINDS.length; i++) if (new RegExp('^(?:' + LIST_KINDS[i][2] + ')$', 'iu').test(word)) return LIST_KINDS[i][0];
    return '';
  }
  function splitItems(s) {
    return String(s).split(/\s*(?:,|;|\sи\s|\sа также\s)\s*/iu).map(tidy).filter(Boolean).map(cap);
  }

  function parseCapture(raw, now, ctx) {
    now = now || new Date();
    ctx = ctx || {};
    let text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) return { type: 'note', text: '' };
    let m;

    // «запиши в категорию Работа: подготовить документы»
    m = text.match(/^(?:запиши|добавь|сохрани)\s+(?:заметку\s+)?в\s+категори[юи]\s+([^:,.\-—]+?)\s*[:,\-—]\s*(.+)$/iu) ||
        text.match(/^(?:запиши|добавь|сохрани)\s+(?:заметку\s+)?в\s+категори[юи]\s+(\S+)\s+(.+)$/iu);
    if (m) return { type: 'note', text: cap(m[2]), cat: cap(m[1].trim()) };

    // «заметка: …», «идея: …»
    m = text.match(/^(?:заметка|запиши\s+заметку|запиши|идея|мысль)\s*[:,\-—]?\s+(.+)$/iu);
    if (m && !/^(?:в\s+)/iu.test(m[1])) return { type: 'note', text: cap(m[1]), cat: /^идея/iu.test(text) && ctx.cats && ctx.cats.some((c) => /^иде/iu.test(c)) ? ctx.cats.find((c) => /^иде/iu.test(c)) : '' };

    // «добавь в покупки молоко и хлеб», «в список книг: мастер и маргарита»
    m = text.match(/^(?:добавь|запиши|внеси|закинь)\s+(?:в\s+)?(?:список\s+)?([\p{L}\-]+)\s*[:,\-—]?\s+(.+)$/iu);
    if (m) {
      const kind = listKind(m[1]);
      const custom = !kind && ctx.lists ? ctx.lists.find((l) => l.name.toLowerCase().indexOf(m[1].toLowerCase().slice(0, 5)) === 0) : null;
      if (kind || custom) return { type: 'list', list: kind || custom.id, text: cap(m[2]), items: /^(?:books|movies)$/.test(kind) ? [cap(tidy(m[2]))] : splitItems(m[2]) };
    }
    // «купить молоко, хлеб и яйца» без суммы — в список покупок
    m = text.match(/^(?:надо\s+|нужно\s+)?купить\s+(.+)$/iu);
    if (m && !parseAmount(text) && !parseWhen(text, now).date) return { type: 'list', list: 'shop', text: cap(m[1]), items: splitItems(m[1]) };

    // вода: «выпил стакан воды», «выпила 500 мл воды»
    m = text.match(/выпил[аи]?\s+(?:(\d{2,4})\s*(?:мл|миллилитр[а-я]*)|(\d|один|два|две|три|пол)?\s*(стакан[а-я]*|бутылк[а-я]*|литр[а-я]*|кружк[а-я]*))?\s*(?:воды|вод[уы])/iu);
    if (m) {
      let ml = 250;
      if (m[1]) ml = Number(m[1]);
      else if (m[3]) {
        const base = /^бут/i.test(m[3]) ? 500 : /^литр/i.test(m[3]) ? 1000 : 250;
        const k = m[2] === 'пол' ? 0.5 : (m[2] ? numOf(m[2]) : 1) || 1;
        ml = Math.round(base * k);
      }
      return { type: 'water', text: cap(text), ml: ml };
    }

    // еда: «съел плов 300 грамм», «на обед гречка с курицей»
    m = text.match(/^(?:я\s+)?(?:съел[аи]?|поел[аи]?|скушал[аи]?|позавтракал[аи]?|пообедал[аи]?|поужинал[аи]?|перекусил[аи]?|на\s+(?:завтрак|обед|ужин|перекус)|завтрак|обед|ужин|перекус)\s*[:,\-—]?\s*(.*)$/iu);
    if (m && m[1] !== undefined) {
      const food = tidy(m[1]) || tidy(text);
      const est = estimateKcal(food);
      const kc = text.match(/(\d{2,4})\s*(?:ккал|калори[а-я]*)/iu);
      return { type: 'meal', text: cap(food.replace(/\s*\d{2,4}\s*(?:ккал|калори[а-я]*)/iu, '')), kcal: kc ? Number(kc[1]) : est.kcal, items: est.items };
    }

    // отметка привычки: «отметь привычку зарядка»
    m = text.match(/^(?:отметь|отметить|выполнил[аи]?)\s+привычк[а-я]*\s+(.+)$/iu);
    if (m) return { type: 'habit', text: cap(tidy(m[1])) };

    const amt = parseAmount(text);
    if (amt && INCOME.test(text)) return { type: 'income', text: cap(text), amount: amt.amount, cat: 'доход' };
    if (amt && EXPENSE.test(text)) return { type: 'expense', text: cap(text), amount: amt.amount, cat: moneyCat(text) };

    let pri = 0;
    if (URGENT.test(text)) { pri = 2; text = text.replace(URGENT, ' '); }
    else if (IMPORTANT.test(text)) { pri = 1; text = text.replace(IMPORTANT, ' '); }
    text = text.replace(/\s+/g, ' ').trim();

    const remind = REMIND.test(text);
    const isMeeting = MEETING.test(text);
    const startsTask = TASK_START.test(text);
    const rep = parseRepeat(text);
    const when = parseWhen(rep.rest, now);
    if (isMeeting || startsTask || when.date || rep.rule) {
      let title = when.rest.replace(TASK_START, '').replace(/^[\s:,\-—]+|[\s:,\-—]+$/g, '');
      title = title.replace(/^(?:о\s+том,?\s+что|что)\s+/iu, '');
      let due = when.date;
      // у повтора дата берётся из правила; время только сдвигает старт на завтра, если уже прошло
      if (rep.rule && (!due || when.fromTime)) due = firstDue(rep.rule, due || dkey(now));
      return {
        type: isMeeting ? 'meeting' : 'task', text: cap(title || when.rest), due: due, time: when.time,
        pri: pri, repeat: rep.rule, remind: remind || (isMeeting && !!when.time)
      };
    }
    return { type: 'note', text: cap(text) };
  }

  /* ---------- прогресс, серии, статистика ---------- */

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

  // серия дней подряд: если сегодня не отмечено, считается со вчера
  function streak(days, todayKey) {
    let d = fromKey(todayKey), n = 0;
    if (!days[todayKey]) d = addDays(d, -1);
    while (days[dkey(d)]) { n++; d = addDays(d, -1); }
    return n;
  }

  /* ---------- .ics для календаря iphone (там напоминание сработает даже при закрытом приложении) ---------- */

  function icsEscape(s) { return String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n'); }
  function rrule(rule) {
    rule = normRule(rule);
    if (!rule) return '';
    const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    if (rule.k === 'days') return 'RRULE:FREQ=DAILY;INTERVAL=' + (rule.n || 1);
    if (rule.k === 'months') return 'RRULE:FREQ=MONTHLY;INTERVAL=' + (rule.n || 1) + (rule.day ? ';BYMONTHDAY=' + rule.day : '');
    if (rule.k === 'nth') return 'RRULE:FREQ=MONTHLY;BYDAY=' + rule.nth + BY[rule.wd];
    return 'RRULE:FREQ=WEEKLY;INTERVAL=' + (rule.n || 1) + (rule.wd && rule.wd.length ? ';BYDAY=' + rule.wd.map((x) => BY[x]).join(',') : '');
  }
  function ics(item, stamp) {
    const day = item.due.replace(/-/g, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DDX Planner//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + item.id + '@ddx-planner', 'DTSTAMP:' + (stamp || '20260101T000000Z')];
    if (item.time) {
      const t = item.time.replace(':', '') + '00';
      const end = new Date(fromKey(item.due).getTime());
      const hm = item.time.split(':').map(Number);
      end.setHours(hm[0], hm[1] + (item.kind === 'meeting' ? 60 : 15));
      lines.push('DTSTART:' + day + 'T' + t, 'DTEND:' + dkey(end).replace(/-/g, '') + 'T' + pad(end.getHours()) + pad(end.getMinutes()) + '00');
    } else {
      lines.push('DTSTART;VALUE=DATE:' + day, 'DTEND;VALUE=DATE:' + dkey(addDays(fromKey(item.due), 1)).replace(/-/g, ''));
    }
    lines.push('SUMMARY:' + icsEscape(item.title));
    if (item.place) lines.push('LOCATION:' + icsEscape(item.place));
    const r = rrule(item.repeat);
    if (r) lines.push(r);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(item.title), 'TRIGGER:' + (item.time ? '-PT0M' : 'PT9H'), 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
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

  // имя: только буквы, цифры, пробел, дефис, точка и апостроф; до 24 символов; каждая часть с заглавной
  function cleanName(s) {
    const t = String(s || '').replace(/[^\p{L}\p{N} '’.\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    return t.replace(/(^|[ \-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
  }

  const api = {
    pad: pad, dkey: dkey, fromKey: fromKey, addDays: addDays, addMonths: addMonths, monthKey: monthKey, weekStart: weekStart,
    daysBetween: daysBetween, normCode: normCode, plural: plural,
    normRule: normRule, nextDue: nextDue, firstDue: firstDue, repeatLabel: repeatLabel, parseRepeat: parseRepeat, WD_SHORT: WD_SHORT, WD_ACC: WD_ACC,
    parseAmount: parseAmount, parseWhen: parseWhen, parseCapture: parseCapture, moneyCat: moneyCat, MONEY_CAT_LIST: MONEY_CAT_LIST,
    estimateKcal: estimateKcal, FOODS: FOODS, LIST_KINDS: LIST_KINDS, splitItems: splitItems,
    dayStats: dayStats, streak: streak, ics: ics, cap: cap, greeting: greeting, cleanName: cleanName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DDXLib = api;
})(typeof window !== 'undefined' ? window : this);
