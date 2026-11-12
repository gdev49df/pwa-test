/* инерционная прокрутка колёсиком мыши и тачпадом на компьютере.
   на телефоне ничего не делаем: там уже родная инерция iOS, она плавнее любого js */
(function () {
  'use strict';
  if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const TAU = 170;            // мс: чем больше, тем дольше «доезжает» страница. не зависит от частоты экрана
  let target = window.scrollY, cur = target, raf = 0, last = 0;
  const max = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  function tick(now) {
    const dt = Math.min(64, last ? now - last : 16); last = now;
    cur += (target - cur) * (1 - Math.exp(-dt / TAU));
    if (Math.abs(target - cur) < 0.3) { cur = target; raf = 0; last = 0; window.scrollTo(0, cur); return; }
    window.scrollTo(0, cur);
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    // окна, поля ввода и горизонтальные ленты прокручиваются сами
    if (e.target.closest && e.target.closest('.sheet, .live-text, textarea, input, select, .chips.scroll')) return;
    e.preventDefault();
    if (!raf) { cur = target = window.scrollY; }
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    target = Math.max(0, Math.min(max(), target + dy));
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: false });

  // любая другая прокрутка (клавиши, переход между разделами) синхронизирует позицию
  window.addEventListener('scroll', () => { if (!raf) { cur = target = window.scrollY; } }, { passive: true });
})();
