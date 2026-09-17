/* common.js - 共享页面行为：年份/回到顶部/滚动 reveal
 * PJAX 下切页后由 pjax.js 调用 window.__commonRebind() 重新绑定新 DOM */
(() => {
  'use strict';

  // 年份 footer
  function bindYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
  }

  // 回到顶部
  function bindToTop() {
    const btn = document.getElementById('to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // 滚动 reveal（统一版本，带交错延迟，上限 400ms）
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

  // 首次加载
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

  // PJAX 切页后重新绑定（pjax.js 在内容替换后调用）
  window.__commonRebind = function() {
    bindYear();
    bindReveal();
  };
})();
