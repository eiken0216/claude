// QlonoLink / GrooveForce Analytics (SME内部) データ取得クライアント
//
// 認証: 手元ブラウザの localStorage（Cognito）を注入 → アプリがトークンを自動更新 →
//       更新後の idToken を Authorization ヘッダーに載せて smeapi を叩く。
//   smeapi ベース: https://prod-sme.analytics.qlonolink.com/smeapi
//   認証: Authorization: <idToken>  （"Bearer" 接頭辞なし・生JWT）
//
// トークンはブラウザ内 (page.evaluate) でのみ使用し、ディスクに書き出さない。
//
// 主なエンドポイント（brand は例: tm_revolution / sme_orangerange）:
//   /brands/{brand}/product_groups                                → 曲(product group)一覧: id,title,streaming_ids,released_at
//   /brands/{brand}/isrc_products?isrcs=<ISRC,...>&search_types=   → ISRC↔曲名マッピング（isrc_products[].isrc / .title）
//   /reports/brands/{brand}/world_sales/daily/by_isrc?start_date&end_date&country_code=JP
//        → {periods:[{end_date, isrcs:[{isrc, streaming_quantity, download_quantity,...}]}]}  日次×ISRC
//   /reports/brands/{brand}/sales/total/by_product_group?country_code=JP  → 累計 streaming_quantity 等（product group id単位）
//   /reports/brands/{brand}/dsp_realtime_chart/latest                     → 各DSP(ITUNES/APPLE_MUSIC…)のリアルタイム順位
//
// 注意: streaming_ids は内部ID（ESCL…形式）で、日次の isrc（JP…形式）とは別体系。
//       曲別集計は「日次の上位ISRC → isrc_products で曲名逆引き → 曲名一致ISRCを日次合算」で行う（下記実装）。
//
// 使い方:
//   QLONO_LS_FILE=/path/to/qlono_localstorage.txt node qlono_api.mjs <brand> "<曲名正規表現>" <start> <end>
//   例: node qlono_api.mjs tm_revolution "HOT ?LIMIT" 2026-06-01 2026-07-10
import { chromium } from 'playwright';
import fs from 'fs';

const SMEAPI = 'https://prod-sme.analytics.qlonolink.com/smeapi';

export async function openSession(lsFile) {
  const LS = JSON.parse(fs.readFileSync(lsFile, 'utf8'));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    locale: 'ja-JP', viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true,
  });
  // ページ通信を Node 側へ迂回（Chromium+プロキシのTLSリセット回避）
  await ctx.route('**/*', async r => { try { await r.fulfill({ response: await r.fetch({ maxRedirects: 0 }) }); } catch { await r.abort().catch(() => {}); } });
  await ctx.addInitScript(ls => { try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {} }, LS);
  const page = await ctx.newPage();
  await page.goto('https://analytics.qlonolink.com/?sk=brand&q=', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  if (/\/login/.test(page.url())) { await browser.close(); throw new Error('QlonoLink セッション切れ — localStorage を取り直してください'); }
  return { browser, page };
}

// 指定ブランド・曲名(正規表現)の日次再生数（複数期間ウィンドウ対応）
export async function songDaily(page, brand, titleRe, windows) {
  return page.evaluate(async ({ brand, reSrc, windows, SMEAPI }) => {
    const re = new RegExp(reSrc, 'i');
    const auth = localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('.idToken')));
    const gj = async u => { const r = await fetch(u, { headers: { authorization: auth } }); return r.ok ? r.json() : { __err: r.status }; };
    let periods = [];
    for (const [s, e] of windows) {
      const d = await gj(`${SMEAPI}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=${s}&end_date=${e}&country_code=JP`);
      periods = periods.concat(d.periods || []);
    }
    // 期間内合計でISRCを絞り、上位ISRCを曲名逆引き
    const tot = {};
    for (const p of periods) for (const it of (p.isrcs || [])) tot[it.isrc] = (tot[it.isrc] || 0) + Number(it.streaming_quantity || 0);
    const topIsrcs = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 60).map(x => x[0]);
    const map = {};
    for (let i = 0; i < topIsrcs.length; i += 40) {
      const ip = await gj(`${SMEAPI}/brands/${brand}/isrc_products?isrcs=${topIsrcs.slice(i, i + 40).join(',')}&search_types=`);
      for (const p of (ip.isrc_products || [])) if (p.isrc) map[p.isrc] = p.title;
    }
    const target = new Set(topIsrcs.filter(i => re.test(map[i] || '')));
    const seen = {}, series = [];
    for (const p of periods) {
      const date = (p.end_date || '').slice(0, 10);
      if (seen[date]) continue; seen[date] = 1;
      let v = 0; for (const it of (p.isrcs || [])) if (target.has(it.isrc)) v += Number(it.streaming_quantity || 0);
      series.push({ date, v });
    }
    series.sort((a, b) => a.date < b.date ? -1 : 1);
    return { isrcs: [...target], titles: [...new Set([...target].map(i => map[i]))], series };
  }, { brand, reSrc: titleRe.source, windows, SMEAPI });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [brand, reSrc, start, end] = process.argv.slice(2);
  if (!brand || !reSrc) { console.error('usage: QLONO_LS_FILE=... node qlono_api.mjs <brand> "<title regex>" <start> <end>'); process.exit(1); }
  const { browser, page } = await openSession(process.env.QLONO_LS_FILE);
  const r = await songDaily(page, brand, new RegExp(reSrc, 'i'), [[start || '2026-06-01', end || '2026-07-10']]);
  const peak = r.series.reduce((m, x) => x.v > m.v ? x : m, { v: 0, date: '' });
  console.log('曲名:', r.titles, 'ISRC:', r.isrcs);
  console.log('日次:', r.series.map(x => `${x.date.slice(5)}:${Math.round(x.v / 1000)}k`).join(' '));
  console.log(`ピーク: ${peak.v.toLocaleString()} (${peak.date})`);
  await browser.close();
}
