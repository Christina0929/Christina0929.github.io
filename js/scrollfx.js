/* 滚动联动效果：进度条 + Hero 视差淡出 + 导航收缩（全站共用）
 * 日志: D:\Default Project\对话日志\2026-08-28.txt
 * 改: 2026-08-28 支持 PJAX 软导航——每次 tick 重新 query hero/page-head，
 *     避免切页后旧节点引用失效（PJAX 回滚：删掉此行说明即可，逻辑在 onScroll 内） */
(() => {
  // 顶部滚动进度条
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  const nav = document.querySelector('nav');

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      // 首页 Hero / 内页页头横幅：PJAX 软导航后节点会重建，这里每次实时查找
      const hero = document.querySelector('.hero') || document.querySelector('.page-head');

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
