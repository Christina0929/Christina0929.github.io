/* PJAX 软导航：切页不刷新整页，共用同一外壳与 <audio>，音乐切换零卡顿
 * 日志: D:\Default Project\对话日志\2026-08-28.txt
 * 回滚: 删除本文件并移除各页 <script src="js/pjax.js"> 即可恢复整页跳转 */
(() => {
  'use strict';

  const SHELL =
    'body > nav, #cl-panel, #music-card, #to-top, .scroll-progress, .theme-fab, .theme-panel, ' +
    '#waifu, #waifu-toggle, #waifu-tips, #kandao-static-img, footer';

  let pageStyleEl = null;
  try { pageStyleEl = document.head.querySelector('style[data-page-css]'); } catch (e) {}

  let navigating = false;
  let navAbort = null;  // AbortController 用于取消超时请求

  function isInternal(a, href) {
    if (!href || href[0] === '#') return false;
    if (a.target === '_blank') return false;
    if (a.host && a.host !== location.host) return false;
    if (/^(mailto:|tel:|javascript:|#|http:|https:|\/\/)/i.test(href)) return false;
    return /\.html$/.test(href);
  }

  function runInlineScript(el) {
    const code = el.textContent || '';
    if (!code.trim()) return;
    try { new Function(code)(); } catch (err) { console.warn('[pjax] inline script error:', err); }
  }

  async function navigate(url, push) {
    if (navigating) return;
    navigating = true;

    // 取消上一次未完成的请求
    if (navAbort) navAbort.abort();
    navAbort = new AbortController();

    try {
      // 8 秒超时
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'pjax' },
        signal: navAbort.signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      if (doc.querySelector('parsererror')) throw new Error('DOM parse failed');

      // 1) 标题
      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      // 2) 页面专属样式
      const newStyle = doc.querySelector('style[data-page-css]');
      if (pageStyleEl && newStyle) pageStyleEl.textContent = newStyle.textContent;

      // 3) 新内容
      const newBodyChildren = Array.from(doc.body.children).filter((el) => {
        if (el.matches && el.matches(SHELL)) return false;
        if (el.tagName === 'SCRIPT' && el.hasAttribute('src')) return false;
        return true;
      });
      const newInlineScripts = newBodyChildren.filter((el) => el.tagName === 'SCRIPT' && !el.hasAttribute('src'));
      const newContent = newBodyChildren.filter((el) => el.tagName !== 'SCRIPT');

      // 4) 删除旧内容
      Array.from(document.body.children).forEach((el) => {
        if (el.matches && el.matches(SHELL)) return;
        if (el.tagName === 'SCRIPT' && el.hasAttribute('src')) return;
        if (el.classList && el.classList.contains('pjax-keep')) return;
        el.remove();
      });

      // 5) 插入新内容
      let anchor = null;
      for (const child of Array.from(document.body.children)) {
        if (child.matches && child.matches(SHELL) && !child.matches('body > nav')) {
          anchor = child;
          break;
        }
      }
      if (anchor) {
        newContent.forEach((el) => anchor.parentNode.insertBefore(el, anchor));
      } else {
        newContent.forEach((el) => document.body.appendChild(el));
      }

      // 6) 执行内联脚本
      newInlineScripts.forEach(runInlineScript);

      // 7) 重新绑定共享行为
      if (typeof window.__commonRebind === 'function') window.__commonRebind();

      // 8) 导航高亮
      const activeLink = doc.querySelector('nav .menu a.active');
      const activeHref = activeLink ? activeLink.getAttribute('href') : null;
      if (activeHref) {
        document.querySelectorAll('nav .menu a').forEach((a) => {
          a.classList.toggle('active', a.getAttribute('href') === activeHref);
        });
      }

      // 9) 历史记录
      if (push) history.pushState({ pjax: url }, '', url);

      // 10) 回到顶部
      window.scrollTo(0, 0);

    } catch (err) {
      if (err.name === 'AbortError') return; // 被新请求取消，不跳转
      console.warn('[pjax] navigation failed, fallback:', err);
      location.href = url;
    } finally {
      navigating = false;
    }
  }

  // 拦截站内链接
  document.addEventListener('click', (e) => {
    if (navigating) return;
    const a = e.target.closest('a');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href') || '';
    if (!isInternal(a, href)) return;
    if (href === location.pathname.split('/').pop()) return;
    e.preventDefault();
    navigate(href, true);
  });

  // 浏览器前进/后退
  window.addEventListener('popstate', () => {
    if (navigating) return;
    const file = location.pathname.split('/').pop();
    if (!file || file === '/') return;
    navigate(file, false);
  });

  window.__pjax = { go: (url) => navigate(url, true) };
})();
