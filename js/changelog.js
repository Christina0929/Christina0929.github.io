// changelog.js - 站点日志时间线
(function () {
  var ENTRIES = [
    { date: '2026-09-01', text: '音乐播放器封面对接：14 曲封面与文件名一一对应，09 曲歌手改为 Superfly' },
    { date: '2026-09-01', text: '随机换曲按钮（mc-shuffle）：卡片控制区内一键随机，do-while 避当前曲' },
    { date: '2026-09-01', text: '播放卡片右边缘垂直拖动：跨页记忆位置，移动端禁用' },
    { date: '2026-09-01', text: 'server.js 中文路径修复 + 缓存策略优化（js/css no-cache，图片 1h，mp3 7 天）' },
    { date: '2026-09-01', text: '导航新增「收藏」入口 → collection.html 图片展示页' },
    { date: '2026-09-01', text: 'PJAX 软导航稳定性提升：并发锁 + parsererror 检查 + DOM null 安全' },
    { date: '2026-08-28', text: '全站改为软导航（PJAX）：切页不刷新，共用同一张音乐卡片，换页音乐零卡顿' },
    { date: '2026-08-27', text: '看板娘沿用泉此方（Konata），新增切页续播（音乐不重置不卡顿）' },
    { date: '2026-08-27', text: '新增留言板、友链交换功能' },
    { date: '2026-08-27', text: '全站加入音乐播放器' },
    { date: '2026-08-27', text: '导航栏改为全宽简洁样式' },
    { date: '2026-08-26', text: '借鉴Z次元优化了UI' },
    { date: '2026-08-26', text: '书签页改版，导入78个书签' },
    { date: '2026-08-26', text: '加入用户自建主题系统（6套主题）' },
    { date: '2026-08-19', text: '全站升级：真实字体文件+3D翻书+看板娘手机自适应' },
    { date: '2026-08-19', text: '文章页布局改单列撑满+头像横排' },
    { date: '2026-08-18', text: '全站改版：极简个人主页+博客列表页+看板娘接入' },
    { date: '2026-08-06', text: '晴天两字统一用accent色高亮' },
    { date: '2026-08-05', text: '新增便签书签板块+博客堆叠卡片效果' },
    { date: '2026-08-05', text: '添加联系留言表单' },
    { date: '2026-08-05', text: '初次提交：晴天小站上线' },
  ];

  function renderTimeline() {
    var container = document.getElementById('cl-timeline');
    if (!container) return;
    var html = '';
    for (var i = 0; i < ENTRIES.length; i++) {
      html += '<div class="cl-item">' +
        '<div class="cl-dot"></div>' +
        '<div class="cl-content">' +
        '<span class="cl-date">' + ENTRIES[i].date + '</span>' +
        '<span class="cl-text">' + ENTRIES[i].text + '</span>' +
        '</div></div>';
    }
    container.innerHTML = html;
  }

  function togglePanel() {
    var panel = document.getElementById('cl-panel');
    if (panel) panel.classList.toggle('open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderTimeline();
    var btn = document.getElementById('cl-toggle');
    if (btn) btn.addEventListener('click', togglePanel);
    document.addEventListener('click', function (e) {
      var panel = document.getElementById('cl-panel');
      var btn = document.getElementById('cl-toggle');
      if (panel && panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  });
})();
