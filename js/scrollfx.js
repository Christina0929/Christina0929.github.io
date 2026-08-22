/* 滚动联动效果：进度条 + Hero 视差淡出 + 导航收缩（全站共用） */
(() => {
  // 顶部滚动进度条
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  const nav = document.querySelector('nav');
  // 首页 Hero / 内页页头横幅：滚动时下沉 + 缩小 + 淡出（视差）
  const hero = document.querySelector('.hero') || document.querySelector('.page-head');

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(sy / max, 1) : 0) + ')';

      if (nav) nav.classList.toggle('scrolled', sy > 40);

      if (hero && hero.classList.contains('visible')) {
        hero.style.transition = 'box-shadow .3s';
        const p = Math.min(sy / 520, 1);
        hero.style.transform = 'translateY(' + (sy * 0.22) + 'px) scale(' + (1 - p * 0.05) + ')';
        hero.style.opacity = String(1 - p * 0.9);
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
