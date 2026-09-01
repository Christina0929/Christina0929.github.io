/* 主题色切换器：右下角调色盘按钮，6 套配色，localStorage 记住选择 */
(() => {
  const THEMES = [
    { key: '',         name: '青屿', dot: 'linear-gradient(135deg,#2fa8b8,#58b990)' },
    { key: 'peach',    name: '蜜桃', dot: 'linear-gradient(135deg,#f08e5f,#f3b56b)' },
    { key: 'lavender', name: '薰衣草', dot: 'linear-gradient(135deg,#8f7fd0,#b18fd8)' },
    { key: 'sakura',   name: '樱花', dot: 'linear-gradient(135deg,#e58aa3,#f0a8bd)' },
    { key: 'forest',   name: '森林', dot: 'linear-gradient(135deg,#5aa06f,#7fbf8e)' },
    { key: 'midnight', name: '星夜', dot: 'linear-gradient(135deg,#142430,#4db6c9)' }
  ];
  const STORE_KEY = 'site-theme';

  const readSaved = () => {
    try { const v = localStorage.getItem(STORE_KEY); if (v !== null && v !== '') return v; } catch (e) {}
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + STORE_KEY + '=([^;]*)'));
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return '';
  };

  const apply = (key) => {
    if (key) document.documentElement.setAttribute('data-theme', key);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(STORE_KEY, key || ''); } catch (e) {}
    try { document.cookie = STORE_KEY + '=' + encodeURIComponent(key || '') + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) {}
    document.querySelectorAll('.tp-item').forEach((b) => {
      b.classList.toggle('active', (b.dataset.key || '') === (key || ''));
    });
  };

  // 悬浮按钮
  const fab = document.createElement('button');
  fab.className = 'theme-fab';
  fab.title = '切换主题配色';
  fab.setAttribute('aria-label', '切换主题配色');
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.2-1.5-.3-.9.3-1.9 1.3-2.1l1.8-.4c1.5-.3 2.7-1.7 2.7-3.3C19 8.6 15.9 3 12 3z"/><circle cx="7.6" cy="11.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.2" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.6" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>';

  // 弹出面板
  const panel = document.createElement('div');
  panel.className = 'theme-panel';
  panel.innerHTML = '<div class="tp-title">主题配色</div><div class="tp-grid">' +
    THEMES.map(t => `<button class="tp-item" data-key="${t.key}"><span class="tp-dot" style="background:${t.dot}"></span><span class="tp-name">${t.name}</span></button>`).join('') +
    '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => panel.classList.remove('open'));

  panel.querySelectorAll('.tp-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      apply(btn.dataset.key);
      panel.classList.remove('open');
    });
  });

  // 初始化：恢复上次选择
  apply(readSaved());
})();
