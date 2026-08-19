/*!
 * 晴天小站 · 看板娘（静态立绘版）
 * 形象：桌面立绘 → live2d/model/custom/kandao.png（白底已去透明）
 * 保留功能：气泡对话（定时/点击/悬停/时段问候）、拖拽、隐藏按钮
 * 说明：静态立绘无 Live2D 骨骼动画；如需动画需将形象制作成 .moc/.moc3 模型
 */
(() => {
  // 手机端：不隐藏，改为缩小 + 停靠可视区（见注入 CSS 的媒体查询与 fitWaifu）
  // 用户之前点过"隐藏"
  if (localStorage.getItem('waifu-disabled') === 'true') return;

  const IMG_SRC = 'live2d/model/custom/kandao.png';
  const JSON_PATH = 'live2d/lib/waifu-tips.json';

  // ---------- 注入覆盖样式（不动 waifu.css，方便以后切回 Live2D 模型） ----------
  const style = document.createElement('style');
  style.textContent = `
    /* ===== 基础容器样式（原 waifu.css 精简，仅保留静态立绘所需） ===== */
    #waifu {
      bottom: 0;
      left: 0;
      position: fixed;
      transition: transform .3s ease-in-out;
      z-index: 200;
      line-height: 0;
    }
    #waifu.waifu-active { bottom: 0; }
    #waifu.waifu-hidden { display: none; }
    #waifu:hover { transform: translateY(20px); }
    #waifu-canvas { line-height: 0; }
    #kandao-img {
      height: min(30vh, 260px);
      width: auto;
      cursor: grab;
      user-select: none;
      -webkit-user-drag: none;
      filter: drop-shadow(0 8px 20px rgba(58, 50, 42, .18));
      transition: filter .3s;
    }
    #kandao-img:hover { filter: drop-shadow(0 8px 20px rgba(58, 50, 42, .28)); }
    #kandao-img:active { cursor: grabbing; }
    /* ===== 气泡 ===== */
    #waifu-tips {
      animation: waifu-shake 50s ease-in-out 5s infinite;
      background-color: rgba(236, 217, 188, .85);
      border: 1px solid rgba(224, 186, 140, .62);
      border-radius: 12px;
      box-shadow: 0 3px 15px 2px rgba(191, 158, 118, .2);
      font-size: 14px;
      line-height: 24px;
      margin: -30px 20px;
      min-height: 70px;
      opacity: 0;
      overflow: hidden;
      padding: 5px 10px;
      position: absolute;
      text-overflow: ellipsis;
      transition: opacity 1s;
      width: 250px;
      word-break: break-all;
      z-index: 201;
    }
    #waifu-tips.waifu-tips-active { opacity: 1; transition: opacity .2s; }
    #waifu-tips span { color: #0099cc; }
    /* ===== 切换按钮 ===== */
    #waifu-toggle {
      background-color: #fa0;
      border-radius: 5px;
      bottom: 66px;
      cursor: pointer;
      display: flex;
      justify-content: flex-end;
      left: 0;
      margin-left: -100px;
      padding: 5px;
      position: fixed;
      transition: margin-left 1s;
      width: 60px;
      z-index: 202;
    }
    #waifu-toggle.waifu-toggle-active { margin-left: -50px; }
    #waifu-toggle.waifu-toggle-active:hover { margin-left: -30px; }
    #waifu-toggle svg { fill: #fff; height: 25px; }
    /* ===== 手机端：缩小看板娘并移到可视区域，避免被边缘裁切/遮挡 ===== */
    @media (max-width: 768px) {
      #waifu { bottom: 0; left: 8px; }
      #kandao-img { height: min(22vh, 150px); }
      #waifu-tips {
        width: 160px;
        font-size: 12px;
        line-height: 20px;
        margin: -26px 8px;
        min-height: 46px;
        padding: 4px 8px;
      }
      #waifu-toggle {
        bottom: 8px;
        width: 50px;
        padding: 4px;
        margin-left: -80px;
      }
      #waifu-toggle.waifu-toggle-active { margin-left: -40px; }
    }
    @keyframes waifu-shake {
      2% { transform: translate(.5px, -1.5px) rotate(-.5deg); }
      4% { transform: translate(.5px, 1.5px) rotate(1.5deg); }
      6% { transform: translate(1.5px, 1.5px) rotate(1.5deg); }
      8% { transform: translate(2.5px, 1.5px) rotate(.5deg); }
      10% { transform: translate(.5px, 2.5px) rotate(.5deg); }
      12% { transform: translate(1.5px, 1.5px) rotate(.5deg); }
      14% { transform: translate(.5px, .5px) rotate(.5deg); }
      16% { transform: translate(-1.5px, -.5px) rotate(1.5deg); }
      18% { transform: translate(.5px, .5px) rotate(1.5deg); }
      20% { transform: translate(2.5px, 2.5px) rotate(1.5deg); }
      22% { transform: translate(.5px, -1.5px) rotate(1.5deg); }
      24% { transform: translate(-1.5px, 1.5px) rotate(-.5deg); }
      26% { transform: translate(1.5px, .5px) rotate(1.5deg); }
      28% { transform: translate(-.5px, -.5px) rotate(-.5deg); }
      30% { transform: translate(1.5px, -.5px) rotate(-.5deg); }
      32% { transform: translate(2.5px, -1.5px) rotate(1.5deg); }
      34% { transform: translate(2.5px, 2.5px) rotate(-.5deg); }
      36% { transform: translate(.5px, -1.5px) rotate(.5deg); }
      38% { transform: translate(2.5px, -.5px) rotate(-.5deg); }
      40% { transform: translate(-.5px, 2.5px) rotate(.5deg); }
      42% { transform: translate(-1.5px, 2.5px) rotate(.5deg); }
      44% { transform: translate(-1.5px, 1.5px) rotate(.5deg); }
      46% { transform: translate(1.5px, -.5px) rotate(-.5deg); }
      48% { transform: translate(2.5px, -.5px) rotate(.5deg); }
      50% { transform: translate(-1.5px, 1.5px) rotate(.5deg); }
      52% { transform: translate(-.5px, 1.5px) rotate(.5deg); }
      54% { transform: translate(-1.5px, 1.5px) rotate(.5deg); }
      56% { transform: translate(.5px, 2.5px) rotate(1.5deg); }
      58% { transform: translate(2.5px, 2.5px) rotate(.5deg); }
      60% { transform: translate(2.5px, -1.5px) rotate(1.5deg); }
      62% { transform: translate(-1.5px, .5px) rotate(1.5deg); }
      64% { transform: translate(-1.5px, 1.5px) rotate(1.5deg); }
      66% { transform: translate(.5px, 2.5px) rotate(1.5deg); }
      68% { transform: translate(2.5px, -1.5px) rotate(1.5deg); }
      70% { transform: translate(2.5px, 2.5px) rotate(.5deg); }
      72% { transform: translate(-.5px, -1.5px) rotate(1.5deg); }
      74% { transform: translate(-1.5px, 2.5px) rotate(1.5deg); }
      76% { transform: translate(-1.5px, 2.5px) rotate(1.5deg); }
      78% { transform: translate(-1.5px, 2.5px) rotate(.5deg); }
      80% { transform: translate(-1.5px, .5px) rotate(-.5deg); }
      82% { transform: translate(-1.5px, .5px) rotate(-.5deg); }
      84% { transform: translate(-.5px, .5px) rotate(1.5deg); }
      86% { transform: translate(2.5px, 1.5px) rotate(.5deg); }
      88% { transform: translate(-1.5px, .5px) rotate(1.5deg); }
      90% { transform: translate(-1.5px, -.5px) rotate(-.5deg); }
      92% { transform: translate(-1.5px, -1.5px) rotate(1.5deg); }
      94% { transform: translate(.5px, .5px) rotate(-.5deg); }
      96% { transform: translate(2.5px, -.5px) rotate(-.5deg); }
      98% { transform: translate(-1.5px, -1.5px) rotate(-.5deg); }
      0%, 100% { transform: translate(0, 0) rotate(0); }
    }
  `;
  document.head.appendChild(style);

  // ---------- 构建看板娘 DOM（复用 waifu.css 类名） ----------
  const waifuToggle = document.createElement('div');
  waifuToggle.id = 'waifu-toggle';
  waifuToggle.setAttribute('aria-label', '显示/隐藏看板娘');
  waifuToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M96 64a64 64 0 1 1 128 0A64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-192.2L59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z"/></svg>`;

  const waifu = document.createElement('div');
  waifu.id = 'waifu';
  waifu.innerHTML = `
    <div id="waifu-tips"></div>
    <div id="waifu-canvas">
      <img id="kandao-img" src="${IMG_SRC}" alt="晴天小站看板娘" draggable="false">
    </div>`;

  document.body.appendChild(waifuToggle);
  document.body.appendChild(waifu);

  const tips = document.getElementById('waifu-tips');

  // ---------- 文案加载 ----------
  let messages = {
    default: ['哦，是你啊。今天也在逛呢。', '有点困了，昨晚睡得有点晚。', '看来你的爱还不够呢～这就是爱！=ω=', '曾经有个伟人说过，抓娃娃机是储蓄罐！', '一言蔽之，就是爱啊！'],
    hoverBody: ['呀……干嘛呢。', '鼠标放错地方了吧。', '小心我咬你哦 =ω=', '爱还不够呢！'],
    tapBody: ['别戳啦。', '会凹进去的。', '再点的话，作业就拜托你了哦。'],
    copy: '复制了要标明出处哦。不然爱不够呢！',
    visibilitychange: '欢迎回来。正好一起刷副本。',
    goodbye: '愿你有一天能与重要的人重逢。我先去玩会儿游戏了。=ω=',
    welcome: '欢迎阅读<span>「$1」</span>～我也来围观一下。'
  };
  let times = [];

  fetch(JSON_PATH, { cache: 'no-store' })
    .then((r) => r.json())
    .then((cfg) => {
      if (cfg.message) Object.assign(messages, cfg.message);
      if (Array.isArray(cfg.time)) times = cfg.time;
    })
    .catch(() => {});

  // ---------- 气泡逻辑 ----------
  let timer = null;
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function show(text, duration = 4000, priority = 9) {
    if (!tips) return;
    tips.innerHTML = text;
    tips.classList.add('waifu-tips-active');
    clearTimeout(timer);
    timer = setTimeout(() => tips.classList.remove('waifu-tips-active'), duration);
  }

  // 时段问候（首次进入）
  function hourGreeting() {
    const h = new Date().getHours();
    for (const t of times) {
      const [a, b] = t.hour.split('-').map(Number);
      if (h >= a && h <= b) return pick(Array.isArray(t.text) ? t.text : [t.text]);
    }
    return null;
  }

  // 首屏欢迎
  setTimeout(() => {
    const title = document.title.replace(/\s*·.*/, '').trim();
    const greet = hourGreeting();
    const msg = greet || messages.welcome.replace('$1', title);
    show(msg, 6000, 11);
  }, 800);

  // 空闲 20s 后随机聊天
  let idleTimer = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => show(pick(messages.default), 6000, 9), 20000);
  }
  window.addEventListener('mousemove', resetIdle, { passive: true });
  window.addEventListener('keydown', resetIdle);
  resetIdle();

  // 悬停 / 点击角色
  const img = document.getElementById('kandao-img');
  img.addEventListener('mouseenter', () => show(pick(messages.hoverBody), 4000, 8));
  img.addEventListener('click', () => show(pick(messages.tapBody), 4000, 9));

  // 复制提示
  document.addEventListener('copy', () => show(messages.copy, 6000, 9));

  // 切回标签页
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) show(messages.visibilitychange, 6000, 9);
  });

  // ---------- 拖拽 ----------
  const drag = () => {
    let winW = window.innerWidth, winH = window.innerHeight;
    const w = waifu.offsetWidth, h = waifu.offsetHeight;
    waifu.addEventListener('mousedown', (e) => {
      if (e.button === 2) return; // 右键不拖
      if (e.target !== img) return;
      e.preventDefault();
      const offX = e.offsetX, offY = e.offsetY;
      document.onmousemove = (ev) => {
        let x = ev.clientX - offX, y = ev.clientY - offY;
        if (y < 0) y = 0;
        if (y >= winH - h) y = winH - h;
        if (x < 0) x = 0;
        if (x >= winW - w) x = winW - w;
        waifu.style.top = y + 'px';
        waifu.style.left = x + 'px';
      };
      document.onmouseup = () => { document.onmousemove = null; };
    });
    window.onresize = () => { winW = window.innerWidth; winH = window.innerHeight; };
  };
  drag();

  // ---------- 自适应：小屏/被挤出屏幕时缩小并移回可视区 ----------
  function fitWaifu() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const isMobile = vw <= 768;
    const img = document.getElementById('kandao-img');
    // 小屏: 强制用媒体查询的缩小尺寸（兜底，防止内联样式覆盖）
    if (isMobile && img) img.style.height = 'min(22vh, 150px)';
    // 看板娘整体是否溢出可视区
    const rect = waifu.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    let changed = false;
    let nl = parseFloat(waifu.style.left) || 0, nt = parseFloat(waifu.style.top) || 0;
    // 只对拖拽过的（有 left/top 内联值）做钳制；默认 left:0/bottom:0 停靠不动
    const hasInline = waifu.style.left !== '' || waifu.style.top !== '';
    if (hasInline) {
      if (nl + w > vw) { nl = Math.max(0, vw - w); changed = true; }
      if (nl < 0) { nl = 0; changed = true; }
      if (nt + h > vh) { nt = Math.max(0, vh - h); changed = true; }
      if (nt < 0) { nt = 0; changed = true; }
      if (changed) {
        waifu.style.left = nl + 'px';
        waifu.style.top = nt + 'px';
      }
    }
  }
  window.addEventListener('resize', fitWaifu);
  // 首次渲染后检查一次（覆盖"看板娘被裁"的场景）
  setTimeout(fitWaifu, 300);
  setTimeout(fitWaifu, 1200);

  // ---------- 隐藏 / 显示 ----------
  function showWaifu(visible) {
    if (visible) {
      waifu.classList.remove('waifu-hidden');
      waifu.classList.add('waifu-active');
      localStorage.removeItem('waifu-disabled');
    } else {
      waifu.classList.remove('waifu-active');
      waifu.classList.add('waifu-hidden');
      localStorage.setItem('waifu-disabled', 'true');
    }
  }

  waifuToggle.addEventListener('click', () => {
    const hidden = waifu.classList.contains('waifu-hidden');
    if (hidden) {
      showWaifu(true);
      show('我回来啦～', 4000, 9);
    } else {
      show(messages.goodbye, 2000, 11);
      setTimeout(() => showWaifu(false), 2000);
    }
  });

  // 首次显示
  waifu.classList.add('waifu-active');
})();