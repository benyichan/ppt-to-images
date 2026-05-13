#!/usr/bin/env node

/**
 * 将网页 PPT（guizang-ppt-skill 格式）每页导出为高清晰度 PNG 图片。
 *
 * 用法:
 *   node scripts/export-ppt-images.mjs <html路径> [输出目录] [--scale N]
 *
 *   --scale N    Retina 缩放因子 (1=普通, 2=Retina(默认), 3=超清)
 *                例: --scale 2 输出 3840×2160, --scale 3 输出 5760×3240
 *
 * 依赖: npm install puppeteer-core
 *       需要本地 Chrome/Chromium
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

// ── 常量 ──────────────────────────────────────────────

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

// ── 工具函数 ──────────────────────────────────────────

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sanitizeTitle(str) {
  // 保留中文字符和字母数字，其余替换为连字符
  return str
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'untitled';
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

function parseArgs(argv) {
  let scale = 2; // 默认 Retina
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--scale' && i + 1 < argv.length) {
      scale = parseInt(argv[++i], 10);
      if (isNaN(scale) || scale < 1 || scale > 4) {
        console.error('--scale 必须是 1、2 或 3 (1=普通, 2=Retina, 3=超清)');
        process.exit(1);
      }
    } else {
      positional.push(argv[i]);
    }
  }

  return { htmlPath: positional[0], outDir: positional[1], scale };
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  const { htmlPath: rawPath, outDir: rawOutDir, scale } = parseArgs(process.argv.slice(2));

  if (!rawPath) {
    console.error('用法: node export-ppt-images.mjs <html文件路径> [输出目录] [--scale N]');
    console.error('  --scale 1=普通(1920×1080), 2=Retina(3840×2160,默认), 3=超清(5760×3240)');
    process.exit(1);
  }

  const htmlPath = path.resolve(rawPath);
  if (!fs.existsSync(htmlPath)) {
    console.error(`文件不存在: ${htmlPath}`);
    process.exit(1);
  }

  const htmlDir = path.dirname(htmlPath);
  const outDir = rawOutDir ? path.resolve(rawOutDir) : path.join(htmlDir, 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  // 读取 HTML 获取元数据
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  const title = detectTitle(htmlContent);
  const theme = detectThemeColor(htmlContent);
  const ts = timestamp();
  const baseName = `${theme}-${sanitizeTitle(title)}-${ts}`;

  const effW = VIEWPORT_WIDTH * scale;
  const effH = VIEWPORT_HEIGHT * scale;

  console.log(`📄 PPT: ${title}`);
  console.log(`🎨 主题: ${theme}`);
  console.log(`📐 分辨率: ${VIEWPORT_WIDTH}×${VIEWPORT_HEIGHT} @${scale}x = ${effW}×${effH} px`);
  console.log(`📁 输出: ${outDir}`);
  console.log('');

  // ── 启动浏览器 ──
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
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  const page = await browser.newPage();

  // 高清晰度视口：deviceScaleFactor 控制 Retina 渲染
  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: scale,
  });

  // ── 加载 HTML ──
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  await page.waitForSelector('.slide');
  await new Promise(r => setTimeout(r, 1500)); // 等 WebGL + 字体加载

  // 查找所有幻灯片
  const slideCount = await page.evaluate(() =>
    document.querySelectorAll('#deck > .slide').length
  );

  if (slideCount === 0) {
    console.error('未找到幻灯片页面');
    await browser.close();
    process.exit(1);
  }

  console.log(`共 ${slideCount} 页，开始导出...\n`);

  // ── 逐页截图 ──
  for (let i = 0; i < slideCount; i++) {
    // 翻到第 i 页
    await page.evaluate((idx) => {
      const deck = document.getElementById('deck');
      if (deck) {
        deck.style.transform = `translateX(${-idx * 100}vw)`;
        deck.style.transition = 'none';
      }
      window.__currentSlideIndex = idx;

      // 触发动效
      if (window.__playSlide) window.__playSlide(idx);

      // 更新导航圆点
      document.querySelectorAll('#nav .dot').forEach((d, j) =>
        d.classList.toggle('active', j === idx)
      );

      // 切换背景
      const el = document.querySelectorAll('.slide')[idx];
      if (el) {
        const th = el.dataset.theme || (el.classList.contains('light') ? 'light' : 'dark');
        document.body.classList.toggle('light-bg', th === 'light');
      }
    }, i);

    // 等动效播放完 + WebGL 稳定
    await new Promise(r => setTimeout(r, 1200));

    // 截图
    const filePath = path.join(outDir, `${baseName}-slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({
      path: filePath,
      fullPage: false,
      type: 'png',
    });

    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(0);
    console.log(`  [${i + 1}/${slideCount}] ${path.basename(filePath)} (${sizeKB} KB @ ${effW}×${effH})`);
  }

  await browser.close();

  const totalMB = (fs.readdirSync(outDir)
    .filter(f => f.startsWith(baseName))
    .reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0) / 1024 / 1024
  ).toFixed(1);

  console.log(`\n✅ 导出完成！共 ${slideCount} 张图片 (合计 ${totalMB} MB)`);
  console.log(`   📂 ${outDir}`);
}

main().catch(err => {
  console.error('导出失败:', err.message);
  process.exit(1);
});
