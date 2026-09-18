/* common.js - 共享页面行为：年份/回到顶部/滚动 reveal
 * PJAX 下切页后由 pjax.js 调用 window.__commonRebind() 重新绑定新 DOM */
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

  function init() {
    bindYear();
    bindToTop();
    bindReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__commonRebind = function() {
    bindYear();
    bindReveal();
  };
})();
