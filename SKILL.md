---
name: ppt-to-images
description: 将 guizang-ppt-skill 生成的横向翻页网页 PPT 的每一页导出为 PNG 图片。自动提取标题和主题色，按「主题-标题-时间戳-页码」命名保存到本地。
---

# ppt-to-images

将网页 PPT 每页截图为 PNG 图片，保存到本地。

## 依赖

```bash
cd ppt-to-images
npm install
```

需要本地已安装 **Chrome/Chromium**（脚本会自动检测常见安装路径）。

## 用法

```bash
node scripts/export-ppt-images.mjs <html文件路径> [输出目录]
```

- `html文件路径`：必填，PPT 的 index.html 路径
- `输出目录`：可选，默认在 HTML 同级的 `exports/` 目录

## 输出命名格式

```
{主题色名}-{PPT标题}-{YYYYMMDD_HHMMSS}-slide-{页码}.png
```

示例：
```
forest-ink-大天二-Hermes-Agent-20260513_205000-slide-01.png
```

## 配合 guizang-ppt-skill 使用

1. 用 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) 生成 PPT HTML 文件
2. 运行导出命令
3. 图片保存在 exports/ 目录，可直接发送到飞书/微信等平台

## License

MIT
