// changelog.js - 站点日志时间线
(function () {
  var ENTRIES = [
    { date: '2026-09-18', text: '音乐卡片展开/收起过渡动画优化：弹性曲线 + 内部元素交错淡入' },
    { date: '2026-09-01', text: '全站功能升级：PJAX 软导航 + 音乐播放器 + 收藏页 + 留言板 + 友链' },
    { date: '2026-08-28', text: '全站改为软导航（PJAX）：切页不刷新，音乐零卡顿' },
    { date: '2026-08-27', text: '新增留言板、友链交换、全站音乐播放器' },
    { date: '2026-08-26', text: '书签页改版 + 用户自建主题系统（6套主题）' },
    { date: '2026-08-19', text: '全站升级：真实字体文件 + 3D翻书 + 看板娘手机自适应' },
    { date: '2026-08-18', text: '全站改版：极简个人主页 + 博客列表页 + 看板娘接入' },
    { date: '2026-08-05', text: '晴天小站上线：便签书签 + 留言表单 + 博客卡片' },
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
