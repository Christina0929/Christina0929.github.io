/* PJAX 软导航：切页不刷新整页，共用同一外壳与 <audio>，音乐切换零卡顿
 * 日志: D:\Default Project\对话日志\2026-08-28.txt
 * 回滚: 删除本文件并移除各页 <script src="js/pjax.js"> 即可恢复整页跳转 */
(() => {
  'use strict';

  // 每页 <head> 里专属 `<style data-page-css>` 与内联页面脚本存放位置
  // 外壳（永久保留，切页不换）：导航/日志面板/音乐卡片/回到顶部/进度条/主题按钮/看板娘
  // body > nav 只保留主导航（直接子元素），面包屑 nav 在 main/container 内不会被匹配
  const SHELL =
    'body > nav, #cl-panel, #music-card, #to-top, .scroll-progress, .theme-fab, .theme-panel, ' +
    '#waifu, #waifu-toggle, #waifu-tips, #kandao-static-img, footer';

  // 当前页面专属 style 节点引用（head 里第一个带 data-page-css 的 <style>）
  let pageStyleEl = null;
  try { pageStyleEl = document.head.querySelector('style[data-page-css]'); } catch (e) {}

  // 并发锁：防止快速连点导致多个 navigate 同时运行（根因=DOM 重复删除/插入崩坏）
  let navigating = false;

  // 需要跳转的内链规则
  function isInternal(a, href) {
    if (!href || href[0] === '#') return false;
    if (a.target === '_blank') return false;
    if (a.host && a.host !== location.host) return false;
    if (/^(mailto:|tel:|javascript:|#|http:|https:|\/\/)/i.test(href)) return false;
    return /\.html$/.test(href);
  }

  // 页面内联脚本执行：new Function 包裹 → 变量只在函数作用域，避免多次切页时
  // 同名 const/let 与全局冲突；document/window/fetch 等仍可访问。
  function runInlineScript(el) {
    const code = el.textContent || '';
    if (!code.trim()) return;
    try {
      new Function(code)();
    } catch (err) {
      console.warn('[pjax] 页面内联脚本执行失败:', err);
    }
  }

  // 切页主流程
  async function navigate(url, push) {
    if (navigating) return;          // 并发锁：上一次未完成则忽略
    navigating = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 旧内容上滑出（只动 transform，连续运动无空窗；外壳保持稳定不闪）
    if (!reduce) {
      const oldNodes = Array.from(document.body.children).filter((el) => {
        if (el.matches && el.matches(SHELL)) return false;
        return el.tagName !== 'SCRIPT';
      });
      oldNodes.forEach((el) => el.classList.add('pjax-item'));
      requestAnimationFrame(() => document.body.classList.add('pjax-sliding'));
      await new Promise((r) => setTimeout(r, 170));
    }
    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'pjax' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      // 检查解析是否失败（含 XML/非 HTML 响应时会出 parsererror）
      if (doc.querySelector('parsererror')) throw new Error('DOM parse failed');

      // 1) 标题
      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      // 2) 页面专属样式：替换既有 <style data-page-css> 内容
      const newStyle = doc.querySelector('style[data-page-css]');
      if (pageStyleEl && newStyle) pageStyleEl.textContent = newStyle.textContent;

      // 3) 内容区：拿新 body 里所有非外壳的子节点
      const newBodyChildren = Array.from(doc.body.children).filter((el) => {
        if (el.matches && el.matches(SHELL)) return false;      // 外壳不换
        if (el.tagName === 'SCRIPT' && el.hasAttribute('src')) return false; // 公共脚本不重载
        return true;
      });
      // 3b) 只留页面专属内联脚本
      const newInlineScripts = newBodyChildren.filter((el) => el.tagName === 'SCRIPT' && !el.hasAttribute('src'));
      const newContent = newBodyChildren.filter((el) => el.tagName !== 'SCRIPT');

      // 4) 替换旧内容：删除旧 body 里所有非外壳、非公共脚本节点
      Array.from(document.body.children).forEach((el) => {
        if (el.matches && el.matches(SHELL)) return;                    // 外壳保留
        if (el.tagName === 'SCRIPT' && el.hasAttribute('src')) return;  // 公共脚本保留
        if (el.classList && el.classList.contains('pjax-keep')) return; // 显式保留
        el.remove();
      });

      // 5) 插入新内容：找 body 里第一个非 nav 的外壳元素，在它前面插入
      //    不依赖 #cl-panel（它可能在 <main> 里面，不在 body 直接子级）
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

      // 6) 执行新页面内联脚本（在内容就位后执行，先于主题/看板娘？保持原顺序处理即可）
      newInlineScripts.forEach(runInlineScript);

      // 7) 更新导航高亮
      const activeLink = doc.querySelector('nav .menu a.active');
      const activeHref = activeLink ? activeLink.getAttribute('href') : null;
      if (activeHref) {
        document.querySelectorAll('nav .menu a').forEach((a) => {
          a.classList.toggle('active', a.getAttribute('href') === activeHref);
        });
      }

      // 8) 地址栏/历史
      if (push) history.pushState({ pjax: url }, '', url);

      // 9) 回到顶部（保留原有滚动位置在这不需要）
      window.scrollTo(0, 0);

      // 10) 新内容从下方滑入
      if (!reduce) {
        document.body.classList.remove('pjax-sliding');
        const inserted = newContent.filter((el) => el.nodeType === 1);
        inserted.forEach((el) => el.classList.add('pjax-item', 'pjax-enter'));
        requestAnimationFrame(() => requestAnimationFrame(() => {
          inserted.forEach((el) => {
            el.classList.remove('pjax-enter');
            el.classList.add('pjax-enter-active');
            setTimeout(() => el.classList.remove('pjax-enter-active'), 260);
          });
        }));
      }
    } catch (err) {
      console.warn('[pjax] 切换失败，回退整页跳转:', err);
      document.body.classList.remove('pjax-sliding');
      location.href = url;
    } finally {
      navigating = false;            // 无论成功失败都解锁
    }
  }

  // 拦截站内 .html 链接
  document.addEventListener('click', (e) => {
    if (navigating) return;          // 并发锁：加载中不响应新点击
    const a = e.target.closest('a');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href') || '';
    if (!isInternal(a, href)) return;
    if (href === location.pathname.split('/').pop()) return; // 同一页不重复切换
    e.preventDefault();
    navigate(href, true);
  });

  // 浏览器前进/后退
  window.addEventListener('popstate', () => {
    if (navigating) return;          // 并发锁
    const file = location.pathname.split('/').pop();
    if (!file || file === '/') return; // 无文件名时跳过（根路径 fallback 整页跳转）
    navigate(file, false);
  });

  // 暴露给其他内联脚本用（如 blog 文章卡片点击）
  window.__pjax = { go: (url) => navigate(url, true) };
})();