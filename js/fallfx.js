/* fallfx.js — 主题联动的稀疏飘落装饰（秋叶/花瓣/流星）
 * 性能: 单 canvas 层 + ~30fps 节流 + 页面隐藏暂停 + prefers-reduced-motion 跳过
 * 日志: 对话日志/2026-09-27.txt
 * 回滚: 删除本文件、各页 <script src="js/fallfx.js">、pjax.js SHELL 中的 #fallfx */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('fallfx')) return;

  // 各主题的粒子配置：type = leaf|petal|meteor
  const THEME_FX = {
    '':         { type: 'leaf',  colors: ['#9fd0c5', '#bfe3d8', '#a8d8cf'], max: 10 }, // 青屿: 青叶
    peach:      { type: 'leaf',  colors: ['#e8a25e', '#d97f3f', '#f0c07a', '#c96f35'], max: 12 }, // 蜜桃: 秋叶
    sakura:     { type: 'petal', colors: ['#f7c6d4', '#f2aec3', '#fadde6'], max: 14 }, // 樱花: 花瓣
    forest:     { type: 'leaf',  colors: ['#8fbf7a', '#a8d194', '#6fa860'], max: 10 }, // 森林: 绿叶
    lavender:   { type: 'petal', colors: ['#d8d0f2', '#c4b8ec', '#e4ddf8'], max: 12 }, // 薰衣草: 紫瓣
    midnight:   { type: 'meteor', colors: ['#9fd8e8', '#ffffff', '#7ccfe0'], max: 4 }  // 星夜: 流星
  };

  const canvas = document.createElement('canvas');
  canvas.id = 'fallfx';
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
  resize();
  addEventListener('resize', resize);

  // 跟随主题切换
  let fx = THEME_FX[document.documentElement.getAttribute('data-theme')] || THEME_FX[''];
  new MutationObserver(() => {
    fx = THEME_FX[document.documentElement.getAttribute('data-theme')] || THEME_FX[''];
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const rand = (a, b) => a + Math.random() * (b - a);
  let particles = [];
  let lastSpawn = 0, lastFrame = 0;

  function spawn() {
    if (fx.type === 'meteor') {
      // 流星: 从上方斜划，带尾迹，短命
      particles.push({
        type: 'meteor',
        x: rand(innerWidth * 0.15, innerWidth * 0.95),
        y: rand(-40, innerHeight * 0.25),
        vx: rand(-140, -70), vy: rand(120, 200),
        rot: 0, vr: 0, size: rand(1.5, 2.6),
        color: fx.colors[Math.floor(Math.random() * fx.colors.length)],
        born: performance.now(), life: rand(900, 1600)
      });
    } else {
      particles.push({
        type: fx.type,
        x: rand(0, innerWidth),
        y: rand(-30, -10),
        vx: rand(-8, 8), vy: rand(22, 48),
        rot: rand(0, Math.PI * 2), vr: rand(-1.2, 1.2),
        size: fx.type === 'leaf' ? rand(6, 11) : rand(4, 8),
        phase: rand(0, Math.PI * 2), sway: rand(14, 30),
        color: fx.colors[Math.floor(Math.random() * fx.colors.length)],
        born: performance.now(), life: Infinity
      });
    }
  }

  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  function tick(now) {
    requestAnimationFrame(tick);
    if (!running) return;
    if (now - lastFrame < 33) return;          // ~30fps 节流
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    // 稀疏补粒: 每隔随机 0.4~1.2 秒补一个
    if (particles.length < fx.max && now - lastSpawn > rand(400, 1200)) {
      spawn(); lastSpawn = now;
    }

    ctx.clearRect(0, 0, innerWidth, innerHeight);

    particles = particles.filter(p => {
      const age = now - p.born;
      if (p.type === 'meteor') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > innerHeight + 30 || age > p.life) return false;
        const fade = age > p.life * 0.7 ? 1 - (age - p.life * 0.7) / (p.life * 0.3) : 1;
        ctx.globalAlpha = 0.9 * fade;
        // 尾迹
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.13, p.y - p.vy * 0.13);
        ctx.stroke();
        // 头部亮点
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      }
      // 叶/瓣: 下落 + 左右摇曳 + 旋转
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(now / 1000 + p.phase) * p.sway * 0.4) * dt;
      p.rot += p.vr * dt;
      if (p.y > innerHeight + 20) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // 叶脉细线
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      return true;
    });
  }
  requestAnimationFrame(tick);
})();
