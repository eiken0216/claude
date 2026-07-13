// チャート系シグナル
//  - itunesJP: iTunes 日本 トップソング100 でのアーティストの掲載順位（購入チャートの実時間シグナル）
//  - kworbSpotify: kworb（Spotifyチャートの公開ミラー）から国別の掲載を拾う
// Playwright request（プロキシ対応）で取得。
import { request } from 'playwright';

let RC;
async function rc() {
  if (!RC) RC = await request.newContext({
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' },
  });
  return RC;
}
export async function disposeCharts() { if (RC) { await RC.dispose(); RC = null; } }

// iTunes 日本 topsongs（100件）でアーティスト名一致の掲載を返す
export async function itunesJP(artistRe, limit = 100) {
  const r = await (await rc()).get(`https://itunes.apple.com/jp/rss/topsongs/limit=${limit}/json`);
  if (!r.ok()) return { updated: null, hits: [], error: r.status() };
  const d = await r.json();
  const entries = d.feed?.entry || [];
  const hits = [];
  entries.forEach((e, i) => {
    const name = e['im:name']?.label || '';
    const artist = e['im:artist']?.label || '';
    if (artistRe.test(artist) || artistRe.test(name)) hits.push({ rank: i + 1, title: name, artist });
  });
  return { updated: d.feed?.updated?.label || null, total: entries.length, hits };
}

// kworb Spotify 国別（例: jp）ウィークリー・トータルからアーティスト名一致行
export async function kworbSpotify(artistRe, country = 'jp') {
  const r = await (await rc()).get(`https://kworb.net/spotify/country/${country}_weekly.html`);
  if (!r.ok()) return { rows: [], error: r.status() };
  const html = await r.text();
  const rows = [];
  // テーブル行から アーティスト - タイトル と数値を粗く抽出
  const re = /<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>.*?<td class="text mp">(.*?)<\/td>.*?<td[^>]*>([\d,]+)<\/td>/gs;
  let m;
  while ((m = re.exec(html))) {
    const label = m[2].replace(/<[^>]+>/g, '');
    if (artistRe.test(label)) rows.push({ rank: Number(m[1]), label, streams: m[3] });
  }
  return { country, rows: rows.slice(0, 20) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const term = process.argv[2] || 'T.M.Revolution';
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const it = await itunesJP(re);
  console.log(`[iTunes JP] updated=${it.updated}`);
  if (it.hits.length) it.hits.forEach(h => console.log(`  #${h.rank} ${h.title} / ${h.artist}`));
  else console.log('  トップ100内に該当なし');
  const kw = await kworbSpotify(re, 'jp');
  console.log(`[kworb Spotify JP] 該当 ${kw.rows.length} 行`);
  kw.rows.slice(0, 5).forEach(r => console.log(`  #${r.rank} ${r.label} ${r.streams}`));
  await disposeCharts();
}
