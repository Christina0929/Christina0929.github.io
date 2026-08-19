# 晴天小站 ☀️

个人博客站点，托管于 GitHub Pages。

## 页面

- 首页 `index.html` — 个人主页 / 关于我 / 站点信息
- 博客 `blog.html` — 文章列表（含 `post1.html`、`post3.html` 独立文章页）
- 书签 `bookmarks.html` — 收藏链接
- 关于 `about.html` — 关于我
- 联系 `contact.html` — 联系表单

## 看板娘

- **Konata Live2D** 动画看板娘（Cubism 4 `.moc3`）
- 支持**动态 / 静态**切换：动态 = Live2D 动画，静态 = 立绘图片（`live2d/model/custom/kandao.png`）
- 鼠标可拖拽，悬停/点击有气泡台词
- 工具菜单（悬停看板娘出现）：一言 / 模式切换

## 技术栈

- 纯 HTML + CSS + JS，无构建步骤
- 本地字体：霞鹜文楷、Playfair Display、Cormorant Garamond
- Live2D 引擎：`live2d/lib/`（live2d-widget 官方插件）
- 本地预览：`python -m http.server 8765`

## 本地开发

```bash
git clone https://github.com/Christina0929/Christina0929.github.io.git
cd Christina0929.github.io
python -m http.server 8765
# 打开 http://127.0.0.1:8765/
```

修改后直接推送 `master` 分支即可更新 GitHub Pages。
