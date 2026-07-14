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
const weeks = Number(arg('weeks', 8));   // 直近の週次（最新週KPI/WoW用）
const nMonths = Number(arg('months', 36)); // 月次の遡り月数（3年）
const out = arg('out', `../../../../reports/${artist.replace(/[\/。]/g, '')}/data.json`);
const reItunes = new RegExp(itunesTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const LATEST_MONDAY = arg('latest', '2026-06-29'); // GfK 最新取り込み週の月曜（実行時に調整）
const mondays = (n) => { const o = []; const d = new Date(LATEST_MONDAY + 'T00:00:00Z'); for (let i = 0; i < n; i++) o.push(new Date(d - i * 7 * 864e5).toISOString().slice(0, 10)); return o.reverse(); };
// 直近nヶ月の月境界（完全月のみ。LATEST_MONDAYの属する月まで）
const monthBoundaries = (n) => { const d = new Date(LATEST_MONDAY + 'T00:00:00Z'); const Y = d.getUTCFullYear(), M = d.getUTCMonth(); const out = []; for (let i = 0; i < n; i++) { const f = new Date(Date.UTC(Y, M - i, 1)), l = new Date(Date.UTC(Y, M - i + 1, 0)); out.unshift({ key: f.toISOString().slice(0, 7), start: f.toISOString().slice(0, 10), end: l.toISOString().slice(0, 10) }); } return out; };

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
    const WKHIST = Number(arg('wkhist', 156)); // 3年分の週次（曲別ウィークリー＝非SMEの単曲分析用）
    log(`[gfk] weekly x${WKHIST} (3yr) -> monthly trend + 曲別週次 + catalog...`);
    const rc = await makeClient();
    const num = x => Number(x.total_stream_units || 0);
    // 3年分の週次（各週=全曲）→ アーティスト週次 ＋ 曲別週次マトリクス ＋ 曲別リリース日
    const artistWeekly = [], songWeekly = {}, songRelease = {};
    for (const wk of mondays(WKHIST)) {
      let rows = [];
      for (let i = 0; i < 3 && !rows.length; i++) { try { const r = await queryWeek(rc, gfkQuery, wk, wk, { limit: 200 }); if (r.status === 200) rows = r.rows; } catch {} }
      const top = rows.slice().sort((a, b) => num(b) - num(a))[0];
      artistWeekly.push({ week: wk, artistTotal: rows.reduce((s, x) => s + num(x), 0), topSong: top?.title || null, topSongTotal: top ? num(top) : 0 });
      const byTitle = {};
      for (const r of rows) { const t = r.title; if (!t) continue; byTitle[t] = (byTitle[t] || 0) + num(r); if (!songRelease[t] && r.release) songRelease[t] = r.release; }
      for (const [t, v] of Object.entries(byTitle)) (songWeekly[t] = songWeekly[t] || []).push({ week: wk, v });
    }
    // 月次集計（アーティスト3年トレンド用。週→月へ合算）
    const mmap = {};
    for (const w of artistWeekly) { const m = w.week.slice(0, 7); mmap[m] = (mmap[m] || 0) + w.artistTotal; }
    const songMonthlyMap = {};
    for (const [t, ser] of Object.entries(songWeekly)) { const mm = songMonthlyMap[t] = {}; for (const p of ser) { const m = p.week.slice(0, 7); mm[m] = (mm[m] || 0) + p.v; } }
    const monthly = Object.keys(mmap).sort().map(m => {
      let topSong = null, topSongTotal = 0;
      for (const [t, mm] of Object.entries(songMonthlyMap)) { const v = mm[m] || 0; if (v > topSongTotal) { topSongTotal = v; topSong = t; } }
      return { month: m, artistTotal: mmap[m], topSong, topSongTotal };
    });
    const weekly = artistWeekly.slice(-8); // 最新8週（KPI/WoW）
    const catRows = (await queryWeek(rc, gfkQuery, LATEST_MONDAY, LATEST_MONDAY, { limit: 200 })).rows || [];
    const peakW = t => { const s = songWeekly[t] || []; return s.length ? Math.max(...s.map(x => x.v)) : 0; };
    const catalog = catRows.map(x => ({ title: x.title, total: num(x), release: x.release, peakWeekly: peakW(x.title) })).filter(t => t.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);
    // 人気曲上位5のGfK週次（非SME向けの単曲分析・全期間リリース〜現在）
    const songTotals = Object.entries(songWeekly).map(([t, ser]) => ({ title: t, total: ser.reduce((s, x) => s + x.v, 0), series: ser.map(p => ({ week: p.week, total: p.v })), peakWeekly: Math.max(...ser.map(x => x.v)), release: songRelease[t] || null }));
    const topSongsWeekly = songTotals.sort((a, b) => b.total - a.total).slice(0, 5);
    await rc.dispose();
    result.sources.gfk = { metric: 'total_stream_units (Streamed Unit Total)', monthly, weekly, catalog, topSongsWeekly };
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
    // ブランドid解決: 検索窓にアーティスト名を入れ、検索結果 <a href="/brand/{id}"> を名前一致で拾う。
    // 検索は /smeapi/artists?keyword= を叩き、SME配給アーティストなら（お気に入り外でも）ヒットする。
    let brand = qlonoArg;
    if (qlonoArg === 'auto') {
      const norm = s => (s || '').split(/[／\/]/)[0].replace(/[。\s・]/g, '').toLowerCase();
      const want = norm(artist);
      const box = page.locator('input:visible').first();
      await box.click().catch(() => {}); await box.fill(artist.replace(/。$/, '')).catch(() => {});
      await page.waitForTimeout(4000);
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/brand/"]')]
        .map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })));
      // 完全一致優先→部分一致（3文字以上）
      const exact = links.find(l => norm(l.text) === want);
      const part = links.find(l => { const t = norm(l.text); return t.length >= 3 && (t.includes(want) || want.includes(t)); });
      const hit = exact || part;
      brand = hit ? hit.href.split('/brand/')[1].split(/[/?]/)[0] : null;
    }
    if (!brand) { result.availability.qlono = `not-found: 「${artist}」はQlonoLink(SME内部DB)で検索ヒットなし＝SME配給でない可能性。GfK＋Webで分析。SMEなら --qlono <brand_id> 指定も可`; }
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
        const map = {}, tie = {}, rel = {};
        for (let i = 0; i < topIsrcs.length; i += 40) {
          const ip = await gj(`${B}/brands/${brand}/isrc_products?isrcs=${topIsrcs.slice(i, i + 40).join(',')}&search_types=`);
          for (const p of (ip.isrc_products || [])) if (p.isrc) { map[p.isrc] = p.title; rel[p.isrc] = p.released_at || null;
            tie[p.isrc] = (p.tieups || []).map(x => ({ genre: x.genre, title: x.title })); }
        }
        // タイアップ（アニメ/ドラマ/CM等）は QlonoLink の tieups から。曲別に付与。
        const catalog = topIsrcs.map(i => ({ isrc: i, title: map[i] || '?', total28d: tot[i], released: rel[i], tieups: tie[i] || [] })).filter(x => x.total28d > 0);
        // トップ曲の日次系列
        const topIsrc = topIsrcs[0];
        const topSeries = periods.map(p => { const it = (p.isrcs || []).find(x => x.isrc === topIsrc); return { date: (p.end_date || '').slice(0, 10), v: it ? Number(it.streaming_quantity || 0) : 0 }; });
        // 人気曲5曲: デイリー全期間（リリース〜現在）。daily by_isrc を1回で取得し曲別に分解、先頭ゼロ（リリース前）を除去。
        const dh = await gj(`${B}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=2023-01-01&end_date=${end}&country_code=JP`);
        const dper = dh.periods || [];
        const dsum = {}; for (const p of dper) for (const it of (p.isrcs || [])) dsum[it.isrc] = (dsum[it.isrc] || 0) + Number(it.streaming_quantity || 0);
        const top5 = Object.entries(dsum).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
        const need5 = top5.filter(i => !map[i]);
        for (let i = 0; i < need5.length; i += 40) {
          const ip = await gj(`${B}/brands/${brand}/isrc_products?isrcs=${need5.slice(i, i + 40).join(',')}&search_types=`);
          for (const p of (ip.isrc_products || [])) if (p.isrc) { map[p.isrc] = p.title; rel[p.isrc] = p.released_at || rel[p.isrc]; tie[p.isrc] = tie[p.isrc] || (p.tieups || []).map(x => ({ genre: x.genre, title: x.title })); }
        }
        const topSongsDaily = top5.map(isrc => {
          let ser = dper.map(p => { const it = (p.isrcs || []).find(x => x.isrc === isrc); return { date: (p.end_date || '').slice(0, 10), v: it ? Number(it.streaming_quantity || 0) : 0 }; });
          const fnz = ser.findIndex(x => x.v > 0); if (fnz > 0) ser = ser.slice(fnz);
          return { isrc, title: map[isrc] || '?', released: rel[isrc] || null, total: dsum[isrc], tieups: tie[isrc] || [], series: ser };
        });
        // カタログ各曲のデイリー最高値（全期間）
        const peakDailyMap = {};
        for (const p of dper) for (const it of (p.isrcs || [])) { const v = Number(it.streaming_quantity || 0); if (v > (peakDailyMap[it.isrc] || 0)) peakDailyMap[it.isrc] = v; }
        for (const c of catalog) c.peakDaily = peakDailyMap[c.isrc] || 0;
        // デモグラ（サービス横断サマリ）
        const demo = await gj(`${B}/reports/brands/${brand}/streaming_services/demographics/by_services/summaries?start_date=${start.replace(/-/g, '')}&end_date=${end.replace(/-/g, '')}&country_code=JP`);
        // 海外再生（国別・累計）— クロノでしか見れない。主要市場の country_code を順に集計。
        const CCS = ['JP', 'US', 'TW', 'KR', 'HK', 'CN', 'TH', 'ID', 'PH', 'VN', 'MY', 'SG', 'GB', 'DE', 'FR', 'BR', 'MX', 'CA', 'AU'];
        const overseas = [];
        for (const cc of CCS) {
          const r = await gj(`${B}/reports/brands/${brand}/world_sales/total/by_isrc?country_code=${cc}`);
          const tot = Array.isArray(r) ? r.reduce((s, x) => s + Number(x.streaming_quantity || 0), 0) : 0;
          if (tot > 0) overseas.push({ country: cc, streams: tot });
        }
        overseas.sort((a, b) => b.streams - a.streams);
        return { brand, catalog, topSong: map[topIsrc] || null, topSeries, topSongsDaily, dsp, demographics: demo, overseasByCountry: overseas };
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

// ---------- ソース優先順位（レポート作成の指針） ----------
// 国内再生: クロノにあればクロノ優先、無ければGfK。海外再生: クロノのみ（world_sales国別）。
result.primaryStreamingSource = result.availability.qlono === 'ok' ? 'qlono' : (result.availability.gfk === 'ok' ? 'gfk' : 'none');
result.overseasSource = result.availability.qlono === 'ok' ? 'qlono (world_sales by country)' : 'unavailable (海外再生はクロノのみ・SME配給曲のみ)';
result.notes = {
  domestic: 'クロノ(qlono)にあればそれを国内再生の一次ソースに、無ければGfK。',
  overseas: '海外再生はクロノの world_sales 国別集計のみ。Wikipedia言語別PVは「海外の検索関心」であって再生数ではない。',
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
log(`\nsaved ${out}`);
console.log(JSON.stringify(result.availability, null, 1));
