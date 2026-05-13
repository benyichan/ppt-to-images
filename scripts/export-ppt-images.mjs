#!/usr/bin/env node

/**
 * 将网页 PPT（guizang-ppt-skill 格式）每页导出为 PNG 图片。
 *
 * 用法: node export-ppt-images.mjs <html路径> [输出目录]
 *
 * 依赖: npm install -g puppeteer-core
 *       需要本地 Chrome/Chromium
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ── 配置 ──────────────────────────────────────────────
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

// ── 工具函数 ──────────────────────────────────────────

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sanitize(str) {
  return str.replace(/[\\/:*?"<>|.]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'untitled';
}

function detectThemeColor(cssText) {
  const map = {
    '1a2e1f': 'forest-ink',
    '0a0a0b': 'ink-classic',
    '0a1f3d': 'indigo-porcelain',
    '2a1e13': 'kraft-paper',
    '1f1a14': 'dune',
  };
  const match = cssText.match(/--ink:\s*#([0-9a-f]{6})/i);
  if (match && map[match[1]]) return map[match[1]];
  if (match) return `theme-${match[1]}`;
  return 'unknown-theme';
}

function detectTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() : 'untitled';
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('用法: node export-ppt-images.mjs <html文件路径> [输出目录]');
    process.exit(1);
  }

  const htmlPath = path.resolve(args[0]);
  if (!fs.existsSync(htmlPath)) {
    console.error(`文件不存在: ${htmlPath}`);
    process.exit(1);
  }

  const htmlDir = path.dirname(htmlPath);
  const outDir = args[1] ? path.resolve(args[1]) : path.join(htmlDir, 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  // 读取 HTML 获取元数据
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  const title = detectTitle(htmlContent);
  const theme = detectThemeColor(htmlContent);
  const ts = timestamp();
  const baseName = `${theme}-${sanitize(title)}-${ts}`;

  console.log(`📄 PPT: ${title}`);
  console.log(`🎨 主题: ${theme}`);
  console.log(`📁 输出: ${outDir}`);
  console.log('');

  // 启动浏览器
  let browser;
  for (const chromePath of CHROME_PATHS) {
    if (fs.existsSync(chromePath)) {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      break;
    }
  }
  if (!browser) {
    // 尝试自动查找
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  const page = await browser.newPage();

  // 设置视口为 1920×1080 (16:9)
  await page.setViewport({ width: 1920, height: 1080 });

  // 加载 HTML 文件
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // 等待渲染完成
  await page.waitForSelector('.slide');
  await new Promise(r => setTimeout(r, 1000));

  // 查找所有幻灯片
  const slideCount = await page.evaluate(() => {
    return document.querySelectorAll('#deck > .slide').length;
  });

  if (slideCount === 0) {
    console.error('未找到幻灯片页面');
    await browser.close();
    process.exit(1);
  }

  console.log(`共 ${slideCount} 页，开始导出...\n`);

  // 逐页截图
  for (let i = 0; i < slideCount; i++) {
    // 翻到第 i 页
    await page.evaluate((idx) => {
      const deck = document.getElementById('deck');
      if (deck) {
        deck.style.transform = `translateX(${-idx * 100}vw)`;
        deck.style.transition = 'none';
      }
      window.__currentSlideIndex = idx;

      // 触发当前页的动效
      if (window.__playSlide) {
        window.__playSlide(idx);
      }

      // 更新导航圆点
      const dots = document.querySelectorAll('#nav .dot');
      dots.forEach((d, j) => d.classList.toggle('active', j === idx));

      // 更新 body class 切换背景
      const el = document.querySelectorAll('.slide')[idx];
      if (el) {
        const th = el.dataset.theme || (el.classList.contains('light') ? 'light' : 'dark');
        document.body.classList.toggle('light-bg', th === 'light');
      }
    }, i);

    // 等待动效完成
    await new Promise(r => setTimeout(r, 1200));

    // 截图当前页面
    const filePath = path.join(outDir, `${baseName}-slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({
      path: filePath,
      fullPage: false,
      type: 'png',
    });

    const size = fs.statSync(filePath).size;
    console.log(`  [${i + 1}/${slideCount}] ${path.basename(filePath)} (${(size / 1024).toFixed(0)} KB)`);
  }

  await browser.close();

  console.log(`\n✅ 导出完成！共 ${slideCount} 张图片`);
  console.log(`   📂 ${outDir}`);
}

main().catch(err => {
  console.error('导出失败:', err.message);
  process.exit(1);
});
