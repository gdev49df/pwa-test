/* заставка и знакомство на три экрана. показывается один раз, потом спрашиваем имя */
(function () {
  'use strict';
  const D = window.DDX;
  const { h, $ } = D;
  const KEY = 'ddx-onb';

  const SLIDES = [
    ['01', 'Личная ОС', 'Задачи, ритуалы, встречи, еда и дневник — в одном спокойном месте. Всё начинается с Дайджеста: открыл, увидел день, нырнул куда нужно.'],
    ['02', 'Говори', 'Нажми на круглую кнопку и скажи одной фразой — приложение само разложит по разделам: задачи, встречи со временем, еду с калориями, идеи и мысли в дневник.'],
    ['03', 'Еда и вечер', 'Записывай еду и воду — калории посчитаются по привычным блюдам. А вечером приложение предложит разобрать хвосты дня и перенести их на завтра.']
  ];

  // первый экран для тех, кто открыл приложение в браузере: как поставить на экран «Домой»
  const INSTALL = ['00', 'Поставь на экран «Домой»', null];
  const INSTALL_STEPS = [
    ['Открой ссылку в Safari', 'search'],
    ['Нажми «Поделиться»', 'share'],
    ['Выбери «На экран “Домой”»', 'addhome'],
    ['Нажми «Добавить» и открывай с иконки', 'spark']
  ];

  const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
  const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* без памяти покажем снова */ } };

  function afterIntro() {
    if (!D.S.name && D.askName) D.askName();
  }

  function finish() {
    mark();
    const box = $('#onb');
    box.classList.remove('show');
    setTimeout(() => { box.hidden = true; box.replaceChildren(); document.body.classList.remove('lock'); afterIntro(); }, 700);
  }

  function showOnboarding() {
    const box = $('#onb');
    const slides = D.isInstalled() ? SLIDES : [INSTALL].concat(SLIDES);
    let i = 0;
    const draw = (dir) => {
      const s = slides[i], last = i === slides.length - 1;
      box.replaceChildren(
        h('div', { class: 'onb-top' },
          h('div', { class: 'onb-brand' }, D.logo('logo'), h('span', { text: 'DDX PLANNER' })),
          last ? null : h('button', { class: 'onb-skip', type: 'button', text: 'Пропустить', onclick: finish })),
        h('div', { class: 'onb-body ' + (dir || '') },
          h('div', { class: 'onb-no', 'aria-hidden': 'true', text: s[0] }),
          h('h2', { text: s[1] }),
          s[2] ? h('p', { text: s[2] }) : h('div', { class: 'onb-steps' },
            h('ol', null, INSTALL_STEPS.map((x) => h('li', null, h('span', { text: x[0] }), D.icon(x[1])))),
            h('p', { class: 'onb-note', text: 'Так на iPhone работают пуш-напоминания, а приложение открывается на весь экран. Подробная инструкция потом будет в «Ещё».' }))),
        h('div', { class: 'onb-foot' },
          h('div', { class: 'onb-dots', 'aria-hidden': 'true' }, slides.map((x, k) => h('i', { class: k === i ? 'on' : '' }))),
          h('button', { class: 'btn solid block', type: 'button', text: last ? 'Начать' : 'Далее', onclick: () => { if (last) finish(); else { i++; draw('next'); } } })));
    };
    draw();
    box.hidden = false;
    document.body.classList.add('lock');
    requestAnimationFrame(() => box.classList.add('show'));
  }

  // заставка: логотип и «Открываю…», затем растворяется
  $('#splash-logo').append(D.logo('logo big'));
  const t0 = Date.now();
  const hide = () => {
    const sp = $('#splash');
    sp.classList.add('out');
    setTimeout(() => { sp.remove(); }, 900);
    if (seen()) afterIntro(); else showOnboarding();
  };
  const wait = Math.max(0, 700 - (Date.now() - t0));
  setTimeout(hide, wait);
})();
