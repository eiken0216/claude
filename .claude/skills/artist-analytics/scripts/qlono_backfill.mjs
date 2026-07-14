// 既存data.json（GfK済）に QlonoLink(SME) データだけを後付けする。
// GfKを再取得しないので、GfK収集バッチと同時に走らせても衝突しない（Qlonoはステートレス）。
// 使い方: QLONO_LS_FILE=.. node qlono_backfill.mjs <data.json> "<アーティスト名>" [<brand_id>]
import fs from 'fs';
import { openSession } from '../../../../tools/competitor-analytics/qlono_api.mjs';

const dataPath = process.argv[2];
const artist = process.argv[3];
const forceBrand = process.argv[4];
if (!dataPath || !artist) { console.error('usage: qlono_backfill.mjs <data.json> "<artist>" [brand_id]'); process.exit(1); }
const result = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let browser;
try {
  const sess = await openSession(process.env.QLONO_LS_FILE);
  browser = sess.browser; const page = sess.page;
  let brand = forceBrand;
  if (!brand) {
    const norm = s => (s || '').split(/[／\/]/)[0].replace(/[。\s・]/g, '').toLowerCase();
    const want = norm(artist);
    const box = page.locator('input:visible').first();
    await box.click().catch(() => {}); await box.fill(artist.replace(/。$/, '')).catch(() => {});
    await page.waitForTimeout(4000);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/brand/"]')].map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })));
    const exact = links.find(l => norm(l.text) === want);
    const part = links.find(l => { const t = norm(l.text); return t.length >= 3 && (t.includes(want) || want.includes(t)); });
    const hit = exact || part;
    brand = hit ? hit.href.split('/brand/')[1].split(/[/?]/)[0] : null;
    console.error('resolved brand:', brand, '| candidates:', links.slice(0, 8).map(l => l.text).join(' / '));
  }
  if (!brand) { result.availability.qlono = `not-found: 「${artist}」はQlono検索ヒットなし`; }
  else {
    // 大カタログ（20年級）でも落ちないよう、全期間デイリーは6ヶ月チャンク×2パスで取得（メモリ節約）。
    const chunks = []; { const s = new Date('2023-01-01T00:00:00Z'); const endD = new Date(Date.now() - 864e5); let c = new Date(s); while (c < endD) { const e = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 6, 0)); chunks.push([c.toISOString().slice(0, 10), (e < endD ? e : endD).toISOString().slice(0, 10)]); c = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 6, 1)); } }
    const data = await page.evaluate(async ({ brand, chunks }) => {
      const auth = localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('.idToken')));
      const B = 'https://prod-sme.analytics.qlonolink.com/smeapi';
      const gj = async u => { const r = await fetch(u, { headers: { authorization: auth } }); return r.ok ? r.json() : { __err: r.status }; };
      const dsp = await gj(`${B}/reports/brands/${brand}/dsp_realtime_chart/latest`);
      const today = new Date(); const end = new Date(today.getTime() - 864e5).toISOString().slice(0, 10);
      const start = new Date(today.getTime() - 29 * 864e5).toISOString().slice(0, 10);
      const d = await gj(`${B}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=${start}&end_date=${end}&country_code=JP`);
      const periods = d.periods || [];
      const tot = {}; for (const p of periods) for (const it of (p.isrcs || [])) tot[it.isrc] = (tot[it.isrc] || 0) + Number(it.streaming_quantity || 0);
      const topIsrcs = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 20).map(x => x[0]);
      const map = {}, tie = {}, rel = {};
      const fetchNames = async (isrcs) => { for (let i = 0; i < isrcs.length; i += 40) { const ip = await gj(`${B}/brands/${brand}/isrc_products?isrcs=${isrcs.slice(i, i + 40).join(',')}&search_types=`); for (const p of (ip.isrc_products || [])) if (p.isrc) { map[p.isrc] = p.title; rel[p.isrc] = p.released_at || rel[p.isrc]; tie[p.isrc] = tie[p.isrc] || (p.tieups || []).map(x => ({ genre: x.genre, title: x.title })); } } };
      await fetchNames(topIsrcs);
      const catalog = topIsrcs.map(i => ({ isrc: i, title: map[i] || '?', total28d: tot[i], released: rel[i], tieups: tie[i] || [] })).filter(x => x.total28d > 0);
      const topSeries = periods.map(p => { const it = (p.isrcs || []).find(x => x.isrc === topIsrcs[0]); return { date: (p.end_date || '').slice(0, 10), v: it ? Number(it.streaming_quantity || 0) : 0 }; });
      // pass1: 全isrc累計＋デイリー最高（チャンクごとに破棄）
      const dsum = {}, peakDailyMap = {};
      for (const [s, e] of chunks) {
        const r = await gj(`${B}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=${s}&end_date=${e}&country_code=JP`);
        for (const p of (r.periods || [])) for (const it of (p.isrcs || [])) { const v = Number(it.streaming_quantity || 0); dsum[it.isrc] = (dsum[it.isrc] || 0) + v; if (v > (peakDailyMap[it.isrc] || 0)) peakDailyMap[it.isrc] = v; }
      }
      const top5 = Object.entries(dsum).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
      const top5set = new Set(top5);
      await fetchNames(top5.filter(i => !map[i]));
      // pass2: top5だけの日次系列（チャンクごとに破棄）
      const seriesMap = {}; top5.forEach(i => seriesMap[i] = []);
      for (const [s, e] of chunks) {
        const r = await gj(`${B}/reports/brands/${brand}/world_sales/daily/by_isrc?start_date=${s}&end_date=${e}&country_code=JP`);
        for (const p of (r.periods || [])) { const date = (p.end_date || '').slice(0, 10); for (const it of (p.isrcs || [])) if (top5set.has(it.isrc)) seriesMap[it.isrc].push({ date, v: Number(it.streaming_quantity || 0) }); }
      }
      for (const c of catalog) c.peakDaily = peakDailyMap[c.isrc] || 0;
      const topSongsDaily = top5.map(isrc => { let ser = (seriesMap[isrc] || []).sort((a, b) => a.date < b.date ? -1 : 1); const fnz = ser.findIndex(x => x.v > 0); if (fnz > 0) ser = ser.slice(fnz); return { isrc, title: map[isrc] || '?', released: rel[isrc] || null, total: dsum[isrc], tieups: tie[isrc] || [], series: ser }; });
      const demo = await gj(`${B}/reports/brands/${brand}/streaming_services/demographics/by_services/summaries?start_date=${start.replace(/-/g, '')}&end_date=${end.replace(/-/g, '')}&country_code=JP`);
      const CCS = ['JP', 'US', 'TW', 'KR', 'HK', 'CN', 'TH', 'ID', 'PH', 'VN', 'MY', 'SG', 'GB', 'DE', 'FR', 'BR', 'MX', 'CA', 'AU'];
      const overseas = [];
      for (const cc of CCS) { const r = await gj(`${B}/reports/brands/${brand}/world_sales/total/by_isrc?country_code=${cc}`); const t = Array.isArray(r) ? r.reduce((s, x) => s + Number(x.streaming_quantity || 0), 0) : 0; if (t > 0) overseas.push({ country: cc, streams: t }); }
      overseas.sort((a, b) => b.streams - a.streams);
      return { brand, catalog, topSong: map[topIsrcs[0]] || null, topSeries, topSongsDaily, dsp, demographics: demo, overseasByCountry: overseas };
    }, { brand, chunks });
    result.sources.qlono = data;
    result.availability.qlono = 'ok';
    // 一次ソース更新: クロノにあればクロノ優先
    result.primaryStreamingSource = 'qlono';
    result.overseasSource = 'qlono (world_sales by country)';
  }
  await browser.close();
} catch (e) { if (browser) await browser.close().catch(() => {}); result.availability.qlono = 'error:' + String(e).slice(0, 100); }

fs.writeFileSync(dataPath, JSON.stringify(result, null, 1));
console.log('qlono backfill:', result.availability.qlono, '| brand:', result.sources.qlono?.brand);
process.exit(0);
