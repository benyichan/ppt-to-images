# ppt-to-images

> 将 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) 生成的横向翻页网页 PPT 的每一页导出为 PNG 图片。

## 功能

- 🖼️ 自动提取 PPT 标题和主题色
- 📸 逐页截图为 1920×1080 PNG 图片
- 📁 按 `主题-标题-时间戳-页码` 规范命名
- ⚡ 基于 Puppeteer + 本地 Chrome，渲染精准

## 安装

```bash
# 克隆仓库
git clone https://github.com/benyichan/ppt-to-images.git
cd ppt-to-images

# 安装依赖
npm install
```

需要本地已安装 **Chrome/Chromium**（脚本会自动检测）。

## 使用

```bash
node scripts/export-ppt-images.mjs path/to/你的PPT.html
```

图片将输出到 HTML 同级的 `exports/` 目录。

### 示例

```bash
node scripts/export-ppt-images.mjs ~/my-ppt/index.html
```

输出：
```
exports/
├── forest-ink-我的标题-20260513_205000-slide-01.png
├── forest-ink-我的标题-20260513_205000-slide-02.png
├── forest-ink-我的标题-20260513_205000-slide-03.png
└── ...
```

## 自定义输出目录

```bash
node scripts/export-ppt-images.mjs ~/my-ppt/index.html ~/my-images/
```

## 文件名规范

```
{theme}-{title}-{YYYYMMDD_HHMMSS}-slide-{NN}.png
```

主题色自动识别（ink-classic / forest-ink / indigo-porcelain / kraft-paper / dune）。

## 配合 Hermes Agent 使用

本仓库也是一个 Hermes Agent skill。安装到 Hermes：

```bash
hermes skills install https://github.com/benyichan/ppt-to-images
```

或手动克隆到 `$HERMES_HOME/skills/presentation/ppt-to-images/`。

## 依赖

- Node.js 18+
- [puppeteer-core](https://www.npmjs.com/package/puppeteer-core)
- Chrome / Chromium

## License

MIT © 2026 [本义](https://github.com/benyichan)
