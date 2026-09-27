/* common.js - 共享页面行为：年份/回到顶部/滚动 reveal/导航高度变量
 * PJAX 下切页后由 pjax.js 调用 window.__commonRebind() 重新绑定新 DOM
 * 改 2026-09-19: 新增 --nav-h 测量（书签页粘性栏对齐用）
 * 日志: D:\Default Project\对话日志\2026-09-19.txt */
(() => {
  'use strict';

  // 防重复绑定标记
  let toTopBound = false;

  function bindYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
  }

  function bindToTop() {
    if (toTopBound) return; // 已绑定过，不重复添加 scroll 监听
    toTopBound = true;
    const btn = document.getElementById('to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      const b = document.getElementById('to-top');
      if (b) b.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function bindReveal() {
    const els = document.querySelectorAll('.reveal:not(.visible)');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = Math.min(i * 80, 400) + 'ms';
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  }

  // 量出导航真实高度写回 --nav-h，书签页的粘性工具栏靠它贴齐导航下沿
  let navHBound = false;
  function bindNavHeight() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const set = () => {
      const h = Math.round(nav.getBoundingClientRect().height);
      if (h) document.documentElement.style.setProperty('--nav-h', h + 'px');
    };
    set();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
    if (navHBound) return; // PJAX 切页会重复调用，resize 只挂一次
    navHBound = true;
    window.addEventListener('resize', set, { passive: true });
  }

  function init() {
    bindYear();
    bindToTop();
    bindReveal();
    bindNavHeight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__commonRebind = function() {
    bindYear();
    bindReveal();
    bindNavHeight();
  };
})();
