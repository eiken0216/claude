// アーティスト分析オーケストレータ: サブスク+Web+SNSの各ソースを1コマンドで収集しJSON化。
//
// 使い方:
//   GFK_EMAIL=.. GFK_PASSWORD=.. QLONO_LS_FILE=.. \
//   node collect.mjs --artist "原因は自分にある。" [--gfk "原因は自分にある"] [--wiki "原因は自分にある。"] \
//     [--itunes "原因は自分にある"] [--qlono auto|<brand_id>|off] [--weeks 26] --out ../../../reports/<slug>/data.json
//
// 認証情報が無いソースは自動でスキップし、availability に理由を記録する（数値は捏造しない）。
import fs from 'fs';
import path from 'path';
import { request } from 'playwright';
import { jpDaily, langviews, disposeWiki } from './wiki.mjs';
import { itunesJP, kworbSpotify, disposeCharts } from './charts.mjs';
import { makeClient, queryWeek } from '../../../../tools/competitor-analytics/gfk_api.mjs';
import { openSession } from '../../../../tools/competitor-analytics/qlono_api.mjs';

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; }
const artist = arg('artist');
if (!artist) { console.error('--artist は必須'); process.exit(1); }
const gfkQuery = arg('gfk', artist.replace(/。$/, ''));
const wikiTitle = arg('wiki', artist);
const itunesTerm = arg('itunes', artist.replace(/。$/, ''));
const qlonoArg = arg('qlono', 'auto');
const weeks = Number(arg('weeks', 26));
const out = arg('out', `../../../../reports/${artist.replace(/[\/。]/g, '')}/data.json`);
const reItunes = new RegExp(itunesTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const LATEST_MONDAY = arg('latest', '2026-06-29'); // GfK 最新取り込み週の月曜（実行時に調整）
const mondays = (n) => { const o = []; const d = new Date(LATEST_MONDAY + 'T00:00:00Z'); for (let i = 0; i < n; i++) o.push(new Date(d - i * 7 * 864e5).toISOString().slice(0, 10)); return o.reverse(); };

const result = { artist, generatedFor: LATEST_MONDAY, availability: {}, sources: {} };
const log = (m) => process.stderr.write(m + '\n');

// ---------- Web/お茶の間（無認証） ----------
try {
  log('[wiki] ja PV + langviews...');
  const jp = await jpDaily(wikiTitle, 90);
  const lv = await langviews(wikiTitle, 30);
  result.sources.wikipedia = { jpDaily: jp.series, langviews: lv.langs };
  result.availability.wikipedia = jp.series.length ? 'ok' : 'no-data';
  await disposeWiki();
} catch (e) { result.availability.wikipedia = 'error:' + String(e).slice(0, 60); }

try {
  log('[charts] iTunes JP...');
  const it = await itunesJP(reItunes);
  const kw = await kworbSpotify(reItunes, 'jp').catch(() => ({ rows: [] }));
  result.sources.charts = { itunesJP: it.hits, itunesUpdated: it.updated, kworbSpotifyJP: kw.rows };
  result.availability.charts = 'ok';
  await disposeCharts();
} catch (e) { result.availability.charts = 'error:' + String(e).slice(0, 60); }

// ---------- GfK（サブスク・国内 Streamed Unit） ----------
if (process.env.GFK_EMAIL && process.env.GFK_PASSWORD) {
  try {
    log('[gfk] weekly trend + catalog...');
    const rc = await makeClient();
    const wks = mondays(weeks);
    const num = x => Number(x.total_stream_units || 0);
    const weekly = [];
    for (const wk of wks) {
      let rows = [];
      for (let i = 0; i < 3 && !rows.length; i++) { try { const r = await queryWeek(rc, gfkQuery, wk, wk, { limit: 200 }); if (r.status === 200) rows = r.rows; } catch {} }
      const top = rows.slice().sort((a, b) => num(b) - num(a))[0];
      weekly.push({ week: wk, artistTotal: rows.reduce((s, x) => s + num(x), 0), topSong: top?.title || null, topSongTotal: top ? num(top) : 0 });
    }
    const catRows = (await queryWeek(rc, gfkQuery, LATEST_MONDAY, LATEST_MONDAY, { limit: 200 })).rows || [];
    const catalog = catRows.map(x => ({ title: x.title, total: num(x), release: x.release })).filter(t => t.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);
    await rc.dispose();
    result.sources.gfk = { metric: 'total_stream_units (Streamed Unit Total)', weekly, catalog };
    result.availability.gfk = 'ok';
  } catch (e) { result.availability.gfk = 'error:' + String(e).slice(0, 80); }
} else result.availability.gfk = 'skipped: GFK_EMAIL/GFK_PASSWORD 未設定';

// ---------- QlonoLink / GrooveForce（SMEアーティストのみ・日次+DSP+デモグラ） ----------
if (qlonoArg !== 'off' && process.env.QLONO_LS_FILE) {
  let browser;
  try {
    log('[qlono] session...');
    const sess = await openSession(process.env.QLONO_LS_FILE);
    browser = sess.browser; const page = sess.page;
    // ブランドid解決: QlonoLinkはアカウントが追跡中のブランドのみ閲覧可。お気に入り一覧を名前照合。
    let brand = qlonoArg;
    if (qlonoArg === 'auto') {
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="/brand/"]')]
        .map(a => ({ href: a.getAttribute('href'), text: (a.innerText || a.textContent || '').trim() })));
      const norm = s => (s || '').split(/[／\/]/)[0].replace(/[。\s・]/g, '').toLowerCase();
      const want = norm(artist);
      const hit = links.find(l => want && (norm(l.text).includes(want) || want.includes(norm(l.text)) && norm(l.text).length >= 2));
      brand = hit ? hit.href.split('/brand/')[1].split(/[/?]/)[0] : null;
    }
    if (!brand) { result.availability.qlono = `not-in-brand-list: 「${artist}」はこのQlonoLinkアカウントの管理ブランドに未登録。QlonoLinkで対象ブランドを追加するか、--qlono <brand_id> を指定`; }
    else {
      const data = await page.evaluate(async (brand) => {
        const auth = localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('.idToken')));
        const B = 'https://prod-sme.analytics.qlonolink.com/smeapi';
        const gj = async u => { const r = await fetch(u, { headers: { authorization: auth } }); return r.ok ? r.json() : { __err: r.status }; };
        const dsp = await gj(`${B}/reports/brands/${brand}/dsp_realtime_chart/latest`);
        // 直近28日 日次 by ISRC → 曲別合計
        const today = new Date(); const end = new Date(today.getTime() - 864e5).toISOString().slice(0, 10);
        const start = new Date(today.getTime() - 29 * 864e5).toISOString().slice(0, 10);
        const d = await gj(`${B}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=${start}&end_date=${end}&country_code=JP`);
        const periods = d.periods || [];
        const tot = {}; for (const p of periods) for (const it of (p.isrcs || [])) tot[it.isrc] = (tot[it.isrc] || 0) + Number(it.streaming_quantity || 0);
        const topIsrcs = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 20).map(x => x[0]);
        const map = {};
        for (let i = 0; i < topIsrcs.length; i += 40) { const ip = await gj(`${B}/brands/${brand}/isrc_products?isrcs=${topIsrcs.slice(i, i + 40).join(',')}&search_types=`); for (const p of (ip.isrc_products || [])) if (p.isrc) map[p.isrc] = p.title; }
        const catalog = topIsrcs.map(i => ({ isrc: i, title: map[i] || '?', total28d: tot[i] })).filter(x => x.total28d > 0);
        // トップ曲の日次系列
        const topIsrc = topIsrcs[0];
        const topSeries = periods.map(p => { const it = (p.isrcs || []).find(x => x.isrc === topIsrc); return { date: (p.end_date || '').slice(0, 10), v: it ? Number(it.streaming_quantity || 0) : 0 }; });
        // デモグラ（サービス横断サマリ）
        const demo = await gj(`${B}/reports/brands/${brand}/streaming_services/demographics/by_services/summaries?start_date=${start.replace(/-/g, '')}&end_date=${end.replace(/-/g, '')}&country_code=JP`);
        return { brand, catalog, topSong: map[topIsrc] || null, topSeries, dsp, demographics: demo };
      }, brand);
      result.sources.qlono = data;
      result.availability.qlono = 'ok';
    }
    await browser.close();
  } catch (e) { if (browser) await browser.close().catch(() => {}); result.availability.qlono = 'error:' + String(e).slice(0, 80); }
} else result.availability.qlono = qlonoArg === 'off' ? 'off' : 'skipped: QLONO_LS_FILE 未設定（SMEアーティストのみ対応）';

// ---------- 手動/環境制約のあるソース（記録のみ） ----------
result.availability.googleTrends = 'manual: データセンターIPは429。手元PCか有償API(SerpAPI等)で';
result.availability.naverDataLab = 'manual: 韓国検索量。フォーム自動操作は未実装';
result.availability.joysound = 'manual: 歌唱者性年代（会員・一定歌唱数の楽曲のみ）';
result.availability.tiktokUGC = 'skill: /tiktok-report で別途取得';
result.availability.igxFollowers = 'manual: Instagram/X フォロワーエクスポート（拡張機能。SME artistはqlonoのデモグラで代替）';

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
log(`\nsaved ${out}`);
console.log(JSON.stringify(result.availability, null, 1));
