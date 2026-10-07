/* fallfx.js — 主题联动的稀疏飘落装饰（秋叶/花瓣/流星）v2
 * v2: 粒子只生成在左右空白区（自动测量内容栏，避开中间卡片）；
 *     切主题瞬间清空重生成；流星减淡；单 canvas 30fps + 隐藏暂停 + 尊重减弱动效
 * 回滚: 删除本文件、各页 <script src="js/fallfx.js">、pjax.js SHELL 中的 #fallfx */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('fallfx')) return;

  const THEME_FX = {
    '':         { type: 'leaf',  colors: ['#9fd0c5', '#bfe3d8', '#a8d8cf'], max: 10 },
    peach:      { type: 'leaf',  colors: ['#e8a25e', '#d97f3f', '#f0c07a', '#c96f35'], max: 12 },
    sakura:     { type: 'petal', colors: ['#f7c6d4', '#f2aec3', '#fadde6'], max: 14 },
    forest:     { type: 'leaf',  colors: ['#8fbf7a', '#a8d194', '#6fa860'], max: 10 },
    lavender:   { type: 'petal', colors: ['#d8d0f2', '#c4b8ec', '#e4ddf8'], max: 12 },
    midnight:   { type: 'meteor', colors: ['#8fc9dc', '#dcecf5', '#7ccfe0'], max: 4 }
  };

  const canvas = document.createElement('canvas');
  canvas.id = 'fallfx';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;';
  const ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);

  let fx = THEME_FX[document.documentElement.getAttribute('data-theme')] || THEME_FX[''];
  new MutationObserver(() => {
    fx = THEME_FX[document.documentElement.getAttribute('data-theme')] || THEME_FX[''];
    particles = [];          // 切主题瞬间清空旧粒子，新配色立即出现
    setTimeout(seed, 60);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // 内容栏测量：粒子只落在左右空白区（窄屏无空白则回退全宽）
  let exclL = 0, exclR = 0;
  function measureExclusion() {
    const el = document.querySelector('main') || document.querySelector('.container');
    if (!el) { exclL = 0; exclR = innerWidth; return; }
    const r = el.getBoundingClientRect();
    exclL = Math.max(0, r.left);
    exclR = Math.min(innerWidth, r.right);
  }
  resize();
  measureExclusion();
  addEventListener('resize', () => measureExclusion());
  setInterval(measureExclusion, 2000);   // PJAX 换页/布局变化兜底

  const rand = (a, b) => a + Math.random() * (b - a);
  let particles = [];
  let lastSpawn = 0, lastFrame = 0;

  function spawnX() {
    // 左右空白区任选；关键修复: 与内容边缘保持 26px 安全距离（叶片不再贴到卡片圆角上
    // 形成"两曲线重合"的脏边），且窄于 56px 的侧带整边禁用（窗口不够宽就不在那边生成）
    const PAD = 26, MIN_ZONE = 56;
    const leftW = exclL - PAD, rightW = innerWidth - exclR - PAD;
    const zones = [];
    if (leftW >= MIN_ZONE) zones.push([8, leftW]);
    if (rightW >= MIN_ZONE) zones.push([exclR + PAD, innerWidth - 8]);
    if (!zones.length) return null;                 // 两侧都太窄: 这一粒放弃
    const z = zones[Math.floor(Math.random() * zones.length)];
    return rand(z[0], z[1]);
  }

  function spawn() {
    const sx = spawnX();
    if (sx === null) return;                        // 无合适空白区则跳过
    if (fx.type === 'meteor') {
      particles.push({
        type: 'meteor',
        x: sx, y: rand(-40, innerHeight * 0.25),
        vx: rand(-140, -70), vy: rand(120, 200),
        size: rand(1.2, 2),
        color: fx.colors[Math.floor(Math.random() * fx.colors.length)],
        born: performance.now(), life: rand(900, 1500)
      });
    } else {
      particles.push({
        type: fx.type,
        x: sx, y: rand(-30, -10),
        vx: rand(-6, 6), vy: rand(22, 48),
        rot: rand(0, Math.PI * 2), vr: rand(-0.5, 0.5),
        size: fx.type === 'leaf' ? rand(9, 13) : rand(5, 8),
        phase: rand(0, Math.PI * 2), sway: rand(14, 30),
        color: fx.colors[Math.floor(Math.random() * fx.colors.length)],
        born: performance.now(), life: Infinity
      });
    }
  }

  // 预铺: 部分粒子直接散布在视口内（含页面顶部），打开就有装饰
  function seed() {
    const n = Math.ceil(fx.max * 0.5);
    for (let i = 0; i < n; i++) {
      spawn();
      const p = particles[particles.length - 1];
      if (p && p.type !== 'meteor') p.y = rand(0, innerHeight * 0.85);
    }
  }
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  function tick(now) {
    requestAnimationFrame(tick);
    if (!running) return;
    if (now - lastFrame < 40) return;          // ~25fps 节流
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    if (particles.length < fx.max && now - lastSpawn > rand(300, 800)) {
      spawn(); lastSpawn = now;
    }

    ctx.clearRect(0, 0, innerWidth, innerHeight);

    particles = particles.filter(p => {
      const age = now - p.born;
      if (p.type === 'meteor') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > innerHeight + 30 || age > p.life) return false;
        const fade = age > p.life * 0.7 ? 1 - (age - p.life * 0.7) / (p.life * 0.3) : 1;
        ctx.globalAlpha = 0.45 * fade;                 // 减淡: 不再刺眼
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.1, p.y - p.vy * 0.1); // 短尾
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.55 * fade;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      }
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(now / 1000 + p.phase) * p.sway * 0.4) * dt;
      p.rot += p.vr * dt;
      if (p.y > innerHeight + 20) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      return true;
    });
  }
  seed();
  requestAnimationFrame(tick);
})();
