// 印刷入稿PDF（トンボ・塗り足し付き）→ 仕上がりサイズでクロップ + SAMPLE透かし → PNG
//
// 使い方:
//   1) pdftoppm -png -r 144 input.pdf page   （PDFをPNG化しておく）
//   2) NODE_PATH=/opt/node22/lib/node_modules node watermark_pdf.mjs <入力PNG> <出力PNG> [dpi=144] [bleed_mm=3]
//
// 仕組み:
//   - 左右は絵柄（塗り足し）エッジをダーク画素の連続走査で検出
//   - 天地は絵柄が白ベタの場合に備え、コーナートンボの水平線
//     （塗り足し線の延長。絵柄左端より外側にある横線）を直接検出
//   - 検出した塗り足しボックスから bleed_mm 内側 = 仕上がり線 でクロップ
//   - 長辺2880pxに縮小し、SAMPLE透かしを合成

import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [,, inPng, outPng, dpiArg, bleedArg] = process.argv;
if (!inPng || !outPng) { console.error('usage: node watermark_pdf.mjs <in.png> <out.png> [dpi] [bleed_mm]'); process.exit(1); }
const DPI = Number(dpiArg || 144);
const BLEED_MM = Number(bleedArg || 3);
const bleedPx = BLEED_MM / 25.4 * DPI;
const MAX_SIDE = 2880;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.setContent('<!DOCTYPE html><html><body></body></html>');

const src = 'data:image/png;base64,' + readFileSync(inPng).toString('base64');

const result = await page.evaluate(async ([src, bleedPx, maxSide]) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const dark = (x, y) => {
    const i = (y * W + x) * 4;
    return d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235;
  };
  // 端から内側に走査して絵柄エッジを検出（複数ラインの中央値。トンボの細線は
  // 「連続して十分な太さのダーク」を要求して除外）
  const solidRun = (probe, from, to, step) => {
    for (let p = from; step > 0 ? p < to : p > to; p += step) {
      let ok = true;
      for (let k = 0; k < 6; k++) { if (!probe(p + step * k)) { ok = false; break; } }
      if (ok) return p;
    }
    return null;
  };
  const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const samplesY = [], samplesX = [];
  for (let f = 0.25; f <= 0.75; f += 0.05) { samplesY.push(Math.round(H * f)); samplesX.push(Math.round(W * f)); }
  const lefts = samplesY.map(y => solidRun(x => dark(x, y), 0, Math.round(W * 0.2), 1)).filter(v => v !== null);
  const rights = samplesY.map(y => solidRun(x => dark(x, y), W - 1, Math.round(W * 0.8), -1)).filter(v => v !== null);
  const left = median(lefts), right = median(rights);
  // 天地: 絵柄左端より外側の帯でコーナートンボの水平線（長さ30px以上のダーク連続）を探す
  const x0 = Math.max(0, Math.round(left - bleedPx * 8)), x1 = Math.max(1, Math.round(left - 4));
  const hLineAt = y => {
    let run = 0;
    for (let x = x0; x <= x1; x++) { run = dark(x, y) ? run + 1 : 0; if (run >= 30) return true; }
    return false;
  };
  let top = null, bottom = null;
  for (let y = 0; y < Math.round(H * 0.2); y++) { if (hLineAt(y)) { top = y; break; } }
  for (let y = H - 1; y > Math.round(H * 0.8); y--) { if (hLineAt(y)) { bottom = y; break; } }
  if (top === null) { // フォールバック: 絵柄エッジ走査
    const tops = samplesX.map(x => solidRun(y => dark(x, y), 0, Math.round(H * 0.2), 1)).filter(v => v !== null);
    top = median(tops);
  }
  if (bottom === null) bottom = H - 1 - top; // フォールバック: 上下対称前提
  // 仕上がり線 = 塗り足しエッジから bleedPx 内側
  const tx = left + bleedPx, ty = top + bleedPx;
  const tw = (right - left + 1) - bleedPx * 2, th = (bottom - top + 1) - bleedPx * 2;
  const scale = Math.min(1, maxSide / Math.max(tw, th));
  const oc = document.createElement('canvas');
  oc.width = Math.round(tw * scale); oc.height = Math.round(th * scale);
  oc.getContext('2d').drawImage(c, tx, ty, tw, th, 0, 0, oc.width, oc.height);
  return {
    url: oc.toDataURL('image/png'), w: oc.width, h: oc.height,
    debug: { W, H, left, right, top, bottom, trimW: tw, trimH: th },
  };
}, [src, bleedPx, MAX_SIDE]);

const mm = v => (v / DPI * 25.4).toFixed(1);
const dbg = result.debug;
console.log(`検出: 塗り足しボックス ${mm(dbg.right - dbg.left + 1)}x${mm(dbg.bottom - dbg.top + 1)}mm / 仕上がり ${mm(dbg.trimW)}x${mm(dbg.trimH)}mm`);

// SAMPLE透かしを載せて書き出し
const { w, h, url } = result;
const fs2 = Math.round(Math.min(w, h) * 0.16);
const wm = await browser.newPage({ viewport: { width: w, height: h } });
await wm.setContent(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; }
  html,body { width:${w}px; height:${h}px; overflow:hidden; background:#fff; }
  img { width:${w}px; height:${h}px; display:block; }
  .wm { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .wm span { font-family:Arial,Helvetica,sans-serif; font-size:${fs2}px; font-weight:bold;
             letter-spacing:0.14em; color:rgba(255,255,255,0.5);
             -webkit-text-stroke:${Math.max(2, Math.round(fs2 / 45))}px rgba(80,80,80,0.45);
             transform:rotate(-18deg); white-space:nowrap; }
</style></head><body><img src="${url}"><div class="wm"><span>SAMPLE</span></div></body></html>`, { waitUntil: 'networkidle' });
await wm.screenshot({ path: outPng });
console.log(`wrote ${outPng} (${w}x${h})`);
await browser.close();
