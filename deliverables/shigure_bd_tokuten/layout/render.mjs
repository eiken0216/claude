// 特典画像レンダラー
// - tokuten_layout.html を 1920x1080 PNG に書き出し（4特典まとめレイアウト）
// - 各特典の単体画像（SAMPLE透かし入り 1600x1200）も書き出し
//
// 実画像の差し替え:
//   layout/assets/ に amazon / sevennet / rakuten / ouenten の名前で
//   .png または .jpg を置いて再実行すると、プレースホルダーが実画像に置き換わる。
//
// 実行: NODE_PATH=/opt/node22/lib/node_modules node render.mjs

import { createRequire } from 'module';
import { readdirSync, existsSync, mkdirSync } from 'fs';
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

function findAsset(key) {
  const assetsDir = path.join(here, 'assets');
  if (!existsSync(assetsDir)) return null;
  const hit = readdirSync(assetsDir).find(f => {
    const base = f.replace(/\.[^.]+$/, '').toLowerCase();
    return base === key && /\.(png|jpe?g|webp)$/i.test(f);
  });
  return hit ? path.join(assetsDir, hit) : null;
}

// 単体画像テンプレート（store帯 + 画像 + SAMPLE透かし）
function singleHtml({ shop, item, imgSrc }) {
  const media = imgSrc
    ? `<img src="${imgSrc}">`
    : `<div class="placeholder">サンプル画像<br>（差し替え）</div>`;
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1600px; height:1200px; overflow:hidden; }
    body { font-family:"IPAPGothic","IPAGothic",sans-serif; background:#0b0b0d; color:#f2f2f2;
           display:flex; flex-direction:column; padding:40px 48px; }
    .shop { background:#c8101e; color:#fff; font-size:40px; font-weight:bold; letter-spacing:0.12em;
            padding:14px 24px; text-align:center; }
    .imgwrap { flex:1; position:relative; display:flex; align-items:center; justify-content:center;
               background:#161619; border:1px solid #2c2c31; border-top:none; }
    .imgwrap img { max-width:94%; max-height:92%; object-fit:contain; }
    .placeholder { color:#55555c; font-size:38px; letter-spacing:0.2em; text-align:center;
                   line-height:1.8; border:2px dashed #3a3a41; padding:70px 120px; }
    .wm { position:absolute; inset:0; overflow:hidden; pointer-events:none;
          display:flex; align-items:center; justify-content:center; }
    .wm span { font-family:Arial,Helvetica,sans-serif; font-size:170px; font-weight:bold;
               letter-spacing:0.18em; color:rgba(255,255,255,0.30);
               -webkit-text-stroke:3px rgba(0,0,0,0.28); transform:rotate(-18deg); white-space:nowrap; }
    .item { font-size:42px; font-weight:bold; letter-spacing:0.1em; text-align:center;
            padding:20px 10px; background:#101013; border:1px solid #2c2c31; border-top:1px solid #2c2c31; }
    .caption { margin-top:14px; text-align:center; color:#9a9aa0; font-size:26px; letter-spacing:0.04em; }
  </style></head><body>
    <div class="shop">${shop}</div>
    <div class="imgwrap">${media}<div class="wm"><span>SAMPLE</span></div></div>
    <div class="item">${item}</div>
    <div class="caption">凛として時雨 LIVE Blu-ray「失神蠍 TOUR 2025 Tornado in Budokan」店舗別購入特典</div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// 1) まとめレイアウト
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(here, 'tokuten_layout.html'));
  // 実画像があればプレースホルダーを置換
  for (const { key } of ITEMS) {
    const asset = findAsset(key);
    if (asset) {
      await page.evaluate(([k, src]) => {
        const wrap = document.querySelector(`.card[data-key="${k}"] .imgwrap`);
        wrap.querySelector('.placeholder')?.remove();
        const img = document.createElement('img');
        img.src = src;
        wrap.prepend(img);
      }, [key, 'file://' + asset]);
    }
  }
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, '特典レイアウト_SAMPLE.png') });
  await page.close();
  console.log('wrote 特典レイアウト_SAMPLE.png');
}

// 2) 単体画像
for (const it of ITEMS) {
  const asset = findAsset(it.key);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.setContent(singleHtml({ ...it, imgSrc: asset ? 'file://' + asset : null }), { waitUntil: 'networkidle' });
  const name = `特典単体_${it.key}_${it.item.replace(/[\/\s]/g, '')}_SAMPLE.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  await page.close();
  console.log('wrote ' + name);
}

await browser.close();
