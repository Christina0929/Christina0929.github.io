# 晴天小站 ☀️

个人博客站点，托管于 GitHub Pages。

## 目录结构

```
├── index.html          首页（Hero 横幅 / 关于我 / 站点信息）
├── blog.html           博客列表
├── post1.html          文章：开站大吉
├── post3.html          文章：正在开发
├── bookmarks.html      书签（搜索 / 分类 / 双栏瀑布流 / 分组折叠）
├── about.html          关于我
├── contact.html        联系我（渠道卡 + 留言表单）
├── css/
│   └── theme.css       唯一公共样式源（组件 / 6 套配色 / 切换器 / 移动端）
├── js/
│   ├── scrollfx.js     滚动联动（进度条 / Hero 视差 / 导航收缩）
│   └── theme-switcher.js  右下角主题色切换器
├── fonts/              霞鹜文楷（正文手写点缀）
├── live2d/             Live2D 看板娘
└── _archive/           归档：废弃演示页、未用字体备份、旧日志（不部署）
```

## 改文字 / 改样式

- **改文字**：直接编辑对应 HTML，搜中文定位；博客列表在 `blog.html` 的 `const posts` 数组
- **改配色**：`css/theme.css` 里的 `[data-theme="xxx"]` 色板块
- **全站组件**（导航 / 卡片 / 页头横幅 / 表单）：都在 `css/theme.css`，改一处全站生效
- **页面专属样式**：在各 HTML 的 `<style>` 里（首页 Hero、书签网格、表单布局等）

## 主题系统

右下角调色盘按钮切换 6 套配色：青屿（默认）/ 蜜桃 / 薰衣草 / 樱花 / 森林 / 星夜（深色）。
选择存 localStorage + cookie，全站保持。

## 看板娘

- **Konata Live2D** 动画看板娘（Cubism 4 `.moc3`）
- 动态 / 静态切换：静态 = 立绘 `live2d/model/custom/kandao.png`
- 可拖拽，悬停/点击有气泡台词；工具菜单：一言 / 模式切换

## 技术栈

- 纯 HTML + CSS + JS，无构建步骤
- 字体：霞鹜文楷（本地）；正文为系统无衬线字体栈
- Live2D 引擎：`live2d/lib/`（live2d-widget 官方插件）
- 响应式：桌面双栏 → 平板单栏 → 手机（导航横滑、卡片堆叠）

## 本地开发

```bash
git clone https://github.com/Christina0929/Christina0929.github.io.git
cd Christina0929.github.io
python -m http.server 8765
# 打开 http://127.0.0.1:8765/
```

修改后直接推送 `master` 分支即可更新 GitHub Pages。
