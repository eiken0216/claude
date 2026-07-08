// 特典画像レンダラー
// - tokuten_layout.html を 1920x1080 PNG に書き出し（4特典まとめレイアウト）
// - 各特典の単体画像（元画像 + SAMPLE透かし、長辺最大2400px）も書き出し
//
// 実画像の配置（layout/assets/）:
//   amazon.png / sevennet.jpg / rakuten_1.jpg rakuten_2.jpg rakuten_3.jpg / ouenten.png
//   （キー名そのまま、または キー_連番。png/jpg/webp対応。無いキーはプレースホルダー表示）
//
// レイアウト内の見せ方（絵柄の見やすさ優先）:
//   amazon   … 白ガター検出で5枚に分割し、2段（2+3）で大きく表示
//   sevennet … 下部キャプション帯を除き、商品部分のみ拡大表示
//   rakuten  … 装着イメージ(_1)とデザインアップ(_3)の2カットに絞って表示
//
// 実行: NODE_PATH=/opt/node22/lib/node_modules node render.mjs

import { createRequire } from 'module';
import { readdirSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'output');
mkdirSync(outDir, { recursive: true });

const ITEMS = [
  { key: 'amazon',   shop: 'Amazon.co.jp',             item: 'ビジュアルシート5枚セット' },
  { key: 'sevennet', shop: 'セブンネットショッピング', item: 'サコッシュ' },
  { key: 'rakuten',  shop: '楽天ブックス',             item: 'スマホショルダー' },
  { key: 'ouenten',  shop: '凛として時雨応援店',       item: 'B2ポスター' },
];

function findAssets(key) {
  const assetsDir = path.join(here, 'assets');
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir)
    .filter(f => {
      const base = f.replace(/\.[^.]+$/, '').toLowerCase();
      return (base === key || base.startsWith(key + '_')) && /\.(png|jpe?g|webp)$/i.test(f);
    })
    .sort()
    .map(f => path.join(assetsDir, f));
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const toDataUrl = p => `data:${MIME[path.extname(p).toLowerCase()] || 'image/png'};base64,` + readFileSync(p).toString('base64');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// ---- canvas ユーティリティ（ページ内で共有） ----
const CANVAS_LIB = `
  async function loadCanvas(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return c;
  }
  function contentTester(c) {
    const { width: w, height: h } = c;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    return (x, y) => {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 8) return false;
      return !(d[i] > 246 && d[i + 1] > 246 && d[i + 2] > 246);
    };
  }
  function bbox(c, isContent, x0, y0, x1, y1, step = 2) {
    let top = y0, bottom = y1, left = x0, right = x1;
    scanTop: for (; top <= y1; top++) { for (let x = x0; x <= x1; x += step) if (isContent(x, top)) break scanTop; }
    scanBottom: for (; bottom >= top; bottom--) { for (let x = x0; x <= x1; x += step) if (isContent(x, bottom)) break scanBottom; }
    scanLeft: for (; left <= x1; left++) { for (let y = top; y <= bottom; y += step) if (isContent(left, y)) break scanLeft; }
    scanRight: for (; right >= left; right--) { for (let y = top; y <= bottom; y += step) if (isContent(right, y)) break scanRight; }
    return { left, top, right, bottom };
  }
  // 走査方向のコンテンツ有無から帯(バンド)を検出。minGap 以上の空白で分割。
  function bands(hasContent, from, to, minGap, minSize) {
    const runs = [];
    let start = null, gap = 0;
    for (let i = from; i <= to; i++) {
      if (hasContent(i)) {
        if (start === null) start = i;
        gap = 0;
      } else if (start !== null) {
        gap++;
        if (gap >= minGap) { runs.push([start, i - gap]); start = null; gap = 0; }
      }
    }
    if (start !== null) runs.push([start, to]);
    return runs.filter(([a, b]) => b - a >= minSize);
  }
  function cut(c, box, maxSide, padRatio = 0.008) {
    const pad = Math.round(Math.max(c.width, c.height) * padRatio);
    const left = Math.max(0, box.left - pad), top = Math.max(0, box.top - pad);
    const right = Math.min(c.width - 1, box.right + pad), bottom = Math.min(c.height - 1, box.bottom + pad);
    const cw = right - left + 1, ch = bottom - top + 1;
    const scale = Math.min(1, maxSide / Math.max(cw, ch));
    const oc = document.createElement('canvas');
    oc.width = Math.round(cw * scale); oc.height = Math.round(ch * scale);
    oc.getContext('2d').drawImage(c, left, top, cw, ch, 0, 0, oc.width, oc.height);
    return [oc.toDataURL('image/png'), oc.width, oc.height];
  }
`;

async function newCanvasPage() {
  const page = await browser.newPage();
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await page.addScriptTag({ content: CANVAS_LIB });
  return page;
}

// 白余白トリムのみ（単体画像用）
async function trimmed(page, srcUrl, maxSide = 2400) {
  return await page.evaluate(async ([src, maxSide]) => {
    const c = await loadCanvas(src);
    const t = contentTester(c);
    const box = bbox(c, t, 0, 0, c.width - 1, c.height - 1);
    return cut(c, box, maxSide, 0.012);
  }, [srcUrl, maxSide]);
}

// 白ガターで行→列に分割して各ピースを返す（amazon用）
async function segmented(page, srcUrl, maxSide = 1200) {
  return await page.evaluate(async ([src, maxSide]) => {
    const c = await loadCanvas(src);
    const t = contentTester(c);
    const whole = bbox(c, t, 0, 0, c.width - 1, c.height - 1);
    const minGapY = Math.round(c.height * 0.01), minGapX = Math.round(c.width * 0.01);
    const minSize = Math.round(Math.max(c.width, c.height) * 0.04);
    const rowHas = y => { for (let x = whole.left; x <= whole.right; x += 2) if (t(x, y)) return true; return false; };
    const rows = bands(rowHas, whole.top, whole.bottom, minGapY, minSize);
    return rows.map(([y0, y1]) => {
      const colHas = x => { for (let y = y0; y <= y1; y += 2) if (t(x, y)) return true; return false; };
      return bands(colHas, whole.left, whole.right, minGapX, minSize)
        .map(([x0, x1]) => cut(c, bbox(c, t, x0, y0, x1, y1), maxSide));
    });
  }, [srcUrl, maxSide]);
}

// 最大の行バンドのみ切り出し（sevennet: キャプション帯除去用）
async function mainBand(page, srcUrl, maxSide = 2000) {
  return await page.evaluate(async ([src, maxSide]) => {
    const c = await loadCanvas(src);
    const t = contentTester(c);
    const whole = bbox(c, t, 0, 0, c.width - 1, c.height - 1);
    const minGapY = Math.round(c.height * 0.008);
    const rowHas = y => { for (let x = whole.left; x <= whole.right; x += 2) if (t(x, y)) return true; return false; };
    const rows = bands(rowHas, whole.top, whole.bottom, minGapY, 4);
    const [y0, y1] = rows.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    return cut(c, bbox(c, t, whole.left, y0, whole.right, y1), maxSide);
  }, [srcUrl, maxSide]);
}

const cv = await newCanvasPage();

// ---- レイアウト用の画像を準備（key -> 行の配列。各行は dataURL の配列）----
const layoutRows = {};
{
  const a = findAssets('amazon');
  if (a.length) {
    const rows = await segmented(cv, toDataUrl(a[0]));
    layoutRows.amazon = rows.map(r => r.map(([url]) => url));
    console.log(`amazon: ${rows.map(r => r.length).join('+')} 枚に分割`);
  }
  const s = findAssets('sevennet');
  if (s.length) {
    const [url] = await mainBand(cv, toDataUrl(s[0]));
    layoutRows.sevennet = [[url]];
    console.log('sevennet: 商品部分を切り出し');
  }
  const r = findAssets('rakuten');
  if (r.length) {
    const pick = [r[0], r[2] ?? r[r.length - 1]].filter(Boolean); // _1(装着) と _3(アップ)
    const urls = [];
    for (const p of pick) { const [url] = await trimmed(cv, toDataUrl(p), 1600); urls.push(url); }
    layoutRows.rakuten = [urls];
    console.log(`rakuten: ${pick.map(p => path_basename(p)).join(', ')} を使用`);
  }
  const o = findAssets('ouenten');
  if (o.length) {
    const [url] = await trimmed(cv, toDataUrl(o[0]), 1600);
    layoutRows.ouenten = [[url]];
    console.log('ouenten: 画像あり');
  }
}
function path_basename(p) { return p.split('/').pop(); }

// 1) まとめレイアウト
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1440 } });
  await page.goto('file://' + path.join(here, 'tokuten_layout.html'));
  for (const { key } of ITEMS) {
    const rows = layoutRows[key];
    if (!rows || !rows.length) continue;
    await page.evaluate(([k, rows]) => {
      const wrap = document.querySelector(`.card[data-key="${k}"] .imgwrap`);
      wrap.querySelector('.placeholder')?.remove();
      wrap.classList.add('has-img');
      const wm = wrap.querySelector('.wm');
      for (const rowUrls of rows) {
        const row = document.createElement('div');
        row.className = 'row';
        for (const u of rowUrls) {
          const img = document.createElement('img');
          img.src = u;
          row.appendChild(img);
        }
        wrap.insertBefore(row, wm);
      }
    }, [key, rows]);
  }
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '特典レイアウト_SAMPLE.png') });
  await page.close();
  console.log('wrote 特典レイアウト_SAMPLE.png');
}

// 2) 単体画像（元画像そのまま + SAMPLE透かし）
function singleRawHtml({ url, w, h }) {
  const fs = Math.round(Math.min(w, h) * 0.16);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; }
    html,body { width:${w}px; height:${h}px; overflow:hidden; background:#fff; }
    img { width:${w}px; height:${h}px; display:block; }
    .wm { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
    .wm span { font-family:Arial,Helvetica,sans-serif; font-size:${fs}px; font-weight:bold;
               letter-spacing:0.14em; color:rgba(255,255,255,0.5);
               -webkit-text-stroke:${Math.max(2, Math.round(fs / 45))}px rgba(80,80,80,0.45);
               transform:rotate(-18deg); white-space:nowrap; }
  </style></head><body>
    <img src="${url}"><div class="wm"><span>SAMPLE</span></div>
  </body></html>`;
}

const SINGLE_LABEL = {
  amazon: 'Amazon_ビジュアルシート5枚セット',
  sevennet: 'セブンネット_サコッシュ',
  rakuten: '楽天_スマホショルダー',
  ouenten: '応援店_B2ポスター',
};

for (const { key } of ITEMS) {
  const files = findAssets(key);
  if (!files.length) { console.log(`skip 単体 ${key}（画像なし）`); continue; }
  for (let n = 0; n < files.length; n++) {
    const [url, w, h] = await trimmed(cv, toDataUrl(files[n]));
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(singleRawHtml({ url, w, h }), { waitUntil: 'networkidle' });
    const suffix = files.length > 1 ? `_${n + 1}` : '';
    const name = `特典単体_${SINGLE_LABEL[key]}${suffix}_SAMPLE.png`;
    await page.screenshot({ path: path.join(outDir, name) });
    await page.close();
    console.log('wrote ' + name);
  }
}

await cv.close();
await browser.close();
