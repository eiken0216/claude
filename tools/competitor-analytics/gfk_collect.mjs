// 龍宮城 と 原因は自分にある。 の国内サブスク再生数（Streamed Unit Total）を
// GfK から26週分収集する。
import fs from 'fs';
import { makeClient, queryWeek } from './gfk_api.mjs';

const LATEST_MONDAY = '2026-06-29'; // 最新取り込み週（week27 2026）の月曜
const N_WEEKS = 26;

const ARTISTS = [
  { key: '龍宮城', query: '龍宮城' },
  { key: '原因は自分にある。', query: '原因は自分にある' }, // 句点なしで表記ゆれ全網羅
];

function mondaysBack(latest, n) {
  const out = [];
  const d = new Date(latest + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    out.push(new Date(d.getTime() - i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out.reverse(); // 古い→新しい
}

const num = (x, f) => Number(x[f] || 0);
function aggregate(rows) {
  return {
    total: rows.reduce((s, x) => s + num(x, 'total_stream_units'), 0),
    premium: rows.reduce((s, x) => s + num(x, 'stream_premium_units'), 0),
    free: rows.reduce((s, x) => s + num(x, 'stream_free_units'), 0),
    tracks: rows.filter(x => num(x, 'total_stream_units') > 0).length,
  };
}

async function queryRetry(rc, q, start, end) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await queryWeek(rc, q, start, end, { limit: 300 });
      if (r.status === 200) return r;
    } catch (e) { /* timeout等はリトライ */ }
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
  return { status: 0, rows: [] };
}

const rc = await makeClient();
const weeks = mondaysBack(LATEST_MONDAY, N_WEEKS);
const rangeStart = weeks[0];
const out = { collectedFor: LATEST_MONDAY, weeks, artists: {} };

for (const a of ARTISTS) {
  process.stderr.write(`\n[${a.key}] 収集中`);
  const weekly = [];
  const spellings = new Set();
  for (const wk of weeks) {
    const r = await queryRetry(rc, a.query, wk);
    r.rows.forEach(x => spellings.add(x.artist));
    weekly.push({ week: wk, ...aggregate(r.rows) });
    process.stderr.write('.');
  }
  // 26週レンジで楽曲別合計
  const rng = await queryRetry(rc, a.query, rangeStart, LATEST_MONDAY);
  const trackTotals = rng.rows
    .map(x => ({
      title: x.title, artist: x.artist, release: x.release, format: x.format,
      total: num(x, 'total_stream_units'), premium: num(x, 'stream_premium_units'), free: num(x, 'stream_free_units'),
    }))
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total);
  // 最新週の楽曲別
  const latest = await queryRetry(rc, a.query, LATEST_MONDAY);
  const latestTracks = latest.rows
    .map(x => ({ title: x.title, total: num(x, 'total_stream_units'), release: x.release }))
    .filter(t => t.total > 0).sort((a, b) => b.total - a.total);

  out.artists[a.key] = { query: a.query, spellings: [...spellings], weekly, trackTotals, latestTracks };
  process.stderr.write(' done');
}

await rc.dispose();
fs.writeFileSync('gfk_data.json', JSON.stringify(out, null, 2));
process.stderr.write('\n\nsaved gfk_data.json\n');

// サマリ出力
for (const [key, d] of Object.entries(out.artists)) {
  const wsum = d.weekly.reduce((s, w) => s + w.total, 0);
  const last = d.weekly[d.weekly.length - 1];
  console.log(`\n【${key}】 検索語:${d.query}  表記ゆれ:${d.spellings.join('/')}`);
  console.log(`  26週合計: ${wsum.toLocaleString()} / 最新週: ${last.total.toLocaleString()} / 楽曲数(最新週): ${last.tracks}`);
  console.log(`  トップ曲(26週): ${d.trackTotals.slice(0,3).map(t=>`${t.title}=${t.total.toLocaleString()}`).join(', ')}`);
}
