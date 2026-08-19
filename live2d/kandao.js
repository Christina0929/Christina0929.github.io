/*!
 * 晴天小站 · 看板娘（Live2D 模型版）
 * 形象：泉此方 Konata（Zhi-san 免费模型，Cubism 4 .moc3）
 * 引擎：官方 live2d-widget（waifu-tips.js）加载 live2dcubismcore + chunk/index2
 * 保留功能：气泡对话（官方内置 hover/tap 事件）、拖拽（鼠标+触屏，自研）、
 *           隐藏/显示按钮（官方 #waifu-toggle）、手机自适应
 * 说明：模型为半身立绘，无内置 idle 动作，但带物理（头发摆动）与鼠标跟随；
 *       点击/悬停时引擎派发 live2d:hoverbody / live2d:tapbody 事件触发气泡
 */
import './lib/waifu-tips.js';

(() => {
  // 旧版静态看板娘用 waifu-disabled 永久隐藏；官方 widget 遇此键会直接不渲染且无开关，
  // 为避免用户被"永久隐藏"卡死，载入时清理一次
  localStorage.removeItem('waifu-disabled');

  // ---------- 注入官方 waifu.css（工具按钮/气泡/隐藏动画的基座样式） ----------
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'live2d/lib/waifu.css';
  document.head.appendChild(link);

  // ---------- 注入覆盖样式（定位/尺寸/手机自适应，延续旧版视觉） ----------
  const style = document.createElement('style');
  style.textContent = `
    /* ===== 覆盖官方 waifu.css：位置与层级 ===== */
    #waifu {
      bottom: 0;
      left: 0;
      z-index: 200;
    }
    #waifu.waifu-active { bottom: 0; }
    #waifu.waifu-hidden { display: none; }
    #waifu:hover { transform: translateY(20px); }
    /* 画布尺寸：官方默认 300px 固定；改为视口自适应，保持 1:1 避免变形 */
    #live2d {
      height: min(30vh, 260px);
      width: min(30vh, 260px);
    }
    /* ===== 气泡：延续旧版半透明白底 ===== */
    #waifu-tips {
      background-color: rgba(236, 217, 188, .85);
      z-index: 6;
    }
    #waifu-tips span { color: #0099cc; }
    /* 工具菜单保持在静态图上可点 */
    #waifu-tool { z-index: 7; }

    /* ===== 静态模式：立绘图片（旧版 kandao.png，高同 Live2D 画布） ===== */
    #kandao-static-img {
      position: absolute;
      left: 0;
      bottom: 0;
      height: min(30vh, 260px);
      width: auto;
      display: none;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      -webkit-user-drag: none;
      z-index: 5;
      filter: drop-shadow(0 8px 20px rgba(58, 50, 42, .18));
      transition: filter .3s;
    }
    #kandao-static-img.show { display: block; }
    #kandao-static-img.show:hover { filter: drop-shadow(0 8px 20px rgba(58, 50, 42, .28)); }
    #kandao-static-img:active { cursor: grabbing; }
    /* ===== 手机端：缩小画布并停靠左下可视区 ===== */
    @media (max-width: 768px) {
      #waifu { left: 8px; }
      #live2d {
        height: min(22vh, 150px);
        width: min(22vh, 150px);
      }
      #kandao-static-img { height: min(22vh, 150px); }
      #waifu-tips {
        width: 160px;
        font-size: 12px;
        line-height: 20px;
        margin: -26px 8px;
        min-height: 46px;
        padding: 4px 8px;
      }
      #waifu-tool svg { height: 18px; }
      #waifu-toggle {
        bottom: 8px;
        width: 50px;
        padding: 4px;
        margin-left: -80px;
      }
      #waifu-toggle.waifu-toggle-active { margin-left: -40px; }
    }
  `;
  document.head.appendChild(style);

  // ---------- 启动官方 Live2D widget ----------
  // waifuPath 以页面根为基准；模型路径在 waifu-tips.json 的 models 中声明
  // drag:false → 关掉官方鼠标拖拽，改用下方自研（支持触屏 + 避免 bottom:0 拉伸）
  window.initWidget({
    waifuPath: 'live2d/lib/waifu-tips.json',
    cubism2Path: 'live2d/lib/live2d.min.js',
    cubism5Path: 'live2d/lib/live2dcubismcore.min.js',
    tools: ['hitokoto'],
    drag: false,
    showToggleAfterQuit: true,
    logLevel: 'info'
  });

  // ---------- 自研拖拽（鼠标 + 触屏），等待 #waifu 出现后绑定 ----------
  function setupDrag() {
    const waifu = document.getElementById('waifu');
    const canvas = document.getElementById('live2d');
    if (!waifu || !canvas) return false;

    let winW = window.innerWidth, winH = window.innerHeight;

    function dragStart(ev, isTouch) {
      if (ev.button === 2) return; // 右键不拖
      const staticImg = document.getElementById('kandao-static-img');
      const allow = ev.target === canvas || (staticImg && ev.target === staticImg && staticImg.classList.contains('show'));
      if (!allow) return;
      ev.preventDefault();
      const cx = isTouch ? ev.touches[0].clientX : ev.clientX;
      const cy = isTouch ? ev.touches[0].clientY : ev.clientY;
      // 以实际渲染位置为基准计算抓取偏移（兼容 bottom:0 停靠与 top/left 拖拽后的状态）
      const rect = waifu.getBoundingClientRect();
      const offX = cx - rect.left;
      const offY = cy - rect.top;
      const w = waifu.offsetWidth, h = waifu.offsetHeight;
      let moved = false; // 点击不拖则保持原定位

      function move(ev2, isTouch2) {
        // 首次移动时才从 bottom 停靠切换到 top/left 跟随
        if (!moved) {
          moved = true;
          waifu.style.bottom = 'auto';
        }
        let x = (isTouch2 ? ev2.touches[0].clientX : ev2.clientX) - offX;
        let y = (isTouch2 ? ev2.touches[0].clientY : ev2.clientY) - offY;
        if (y < 0) y = 0;
        if (y >= winH - h) y = winH - h;
        if (x < 0) x = 0;
        if (x >= winW - w) x = winW - w;
        waifu.style.top = y + 'px';
        waifu.style.left = x + 'px';
      }
      function end() {
        document.onmousemove = null;
        document.onmouseup = null;
        waifu.ontouchmove = null;
        waifu.ontouchend = null;
        waifu.ontouchcancel = null;
      }

      if (isTouch) {
        waifu.ontouchmove = (e) => { e.preventDefault(); move(e, true); };
        waifu.ontouchend = end;
        waifu.ontouchcancel = end;
      } else {
        document.onmousemove = (ev2) => move(ev2, false);
        document.onmouseup = end;
      }
    }

    waifu.addEventListener('mousedown', (e) => dragStart(e, false));
    waifu.addEventListener('touchstart', (e) => dragStart(e, true), { passive: false });
    window.onresize = () => { winW = window.innerWidth; winH = window.innerHeight; };
    return true;
  }

  if (!setupDrag()) {
    // 官方 widget 可能因"最近隐藏"延迟创建 #waifu（点开关才加载），监听补绑
    const obs = new MutationObserver(() => {
      if (setupDrag()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  }

  // ---------- 动态/静态模式切换（自研，不动官方 widget） ----------
  // 思路：静态模式 = 隐藏 live2d 画布，改显旧版立绘图片 kandao.png（图片加载的看板娘）；
  //       动态模式 = 恢复 live2d 画布。选择用 localStorage 记忆。
  const STATIC_KEY = 'kandao-static-mode';
  const STATIC_SRC = 'live2d/model/custom/kandao.png';

  function staticImgEl() {
    let img = document.getElementById('kandao-static-img');
    const waifu = document.getElementById('waifu');
    // 统一挂到 #waifu（position:fixed 定位基准），迟到的元素挪进去
    if (img && waifu && img.parentElement !== waifu) waifu.appendChild(img);
    if (img) return img;
    img = document.createElement('img');
    img.id = 'kandao-static-img';
    img.src = STATIC_SRC;
    img.alt = '晴天小站看板娘 · 静态立绘';
    img.draggable = false;
    img.style.display = 'none';
    (waifu || document.body).appendChild(img);
    return img;
  }

  function setStatic(on) {
    const canvas = document.getElementById('live2d');
    const img = staticImgEl();
    if (!canvas || !img) return;

    if (on) {
      canvas.style.visibility = 'hidden'; // 保留占位，避免容器跳动
      img.classList.add('show');
      img.style.display = 'block';
      localStorage.setItem(STATIC_KEY, '1');
    } else {
      canvas.style.visibility = '';
      img.classList.remove('show');
      img.style.display = 'none';
      localStorage.removeItem(STATIC_KEY);
    }
  }

  // 配置工具按钮
  function setupModeToggle() {
    const tool = document.getElementById('waifu-tool');
    if (!tool) return false;
    if (document.getElementById('waifu-tool-mode')) return true;

    const btn = document.createElement('span');
    btn.id = 'waifu-tool-mode';
    btn.title = '切换 动态/静态 模式（Live2D / 立绘图）';
    // 图标随状态切换：太阳=动态，月亮=静态；点击即切换
    const icons = {
      sun: '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zm9-9a1 1 0 0 1-1 1h-2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1zM4 12a1 1 0 0 1-1 1H1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1zm14.2-6.6a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4-1.4l1.4-1.4a1 1 0 0 1 1.4 0zM8.6 9.6a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4-1.4l1.4-1.4a1 1 0 0 1 1.4 0zm6.8 6.8a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4-1.4l1.4-1.4a1 1 0 0 1 1.4 0zM9.6 15.4a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4-1.4l1.4-1.4a1 1 0 0 1 1.4 0z"/></svg>',
      moon: '<svg viewBox="0 0 24 24"><path d="M12.5 2a10 10 0 1 0 9.5 13.5A9 9 0 0 1 12.5 2z"/></svg>'
    };
    const setIcon = (staticOn) => { btn.innerHTML = staticOn ? icons.moon : icons.sun; };
    const img2 = document.getElementById('kandao-static-img');
    setIcon(img2 && img2.classList.contains('show'));
    btn.addEventListener('click', () => {
      const img = document.getElementById('kandao-static-img');
      const next = !(img && img.classList.contains('show'));
      setStatic(next);
      setIcon(next);
    });
    tool.appendChild(btn);
    return true;
  }

  // 官方 widget 建好后再挂按钮；监听 body 直到 #waifu-tool 出现
  function initModeToggle() {
    if (setupModeToggle()) return;
    const obs = new MutationObserver(() => {
      if (setupModeToggle()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  }
  initModeToggle();

  // 每次进入页面时恢复上次的模式（等 #waifu 出现后应用）
  const savedStatic = localStorage.getItem(STATIC_KEY) === '1';
  if (savedStatic) {
    const stick = setInterval(() => {
      if (document.getElementById('waifu') && document.getElementById('live2d')) {
        clearInterval(stick);
        setStatic(true);
        const btnIcon = document.getElementById('waifu-tool-mode');
        if (btnIcon) btnIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12.5 2a10 10 0 1 0 9.5 13.5A9 9 0 0 1 12.5 2z"/></svg>';
      }
    }, 300);
    setTimeout(() => clearInterval(stick), 10000);
  }

  // ---------- 自适应：拖拽过的小屏被挤出屏幕时钳回可视区 ----------
  function fitWaifu() {
    const waifu = document.getElementById('waifu');
    if (!waifu) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    // 只对拖拽过的（有 left/top 内联值）做钳制；默认 left:0/bottom:0 停靠不动
    if (waifu.style.left === '' && waifu.style.top === '') return;
    const rect = waifu.getBoundingClientRect();
    let nl = parseFloat(waifu.style.left) || 0, nt = parseFloat(waifu.style.top) || 0;
    let changed = false;
    if (nl + rect.width > vw) { nl = Math.max(0, vw - rect.width); changed = true; }
    if (nl < 0) { nl = 0; changed = true; }
    if (nt + rect.height > vh) { nt = Math.max(0, vh - rect.height); changed = true; }
    if (nt < 0) { nt = 0; changed = true; }
    if (changed) {
      waifu.style.left = nl + 'px';
      waifu.style.top = nt + 'px';
    }
  }
  window.addEventListener('resize', fitWaifu);
  setTimeout(fitWaifu, 300);
  setTimeout(fitWaifu, 1500);
})();
