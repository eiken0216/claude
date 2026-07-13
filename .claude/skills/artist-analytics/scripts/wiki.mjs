// Wikipedia 系シグナル（お茶の間の反響＋海外人気）
//  - jpDaily: ja.wikipedia の記事の日次ページビュー（直近N日）
//  - langviews: Wikidata のサイトリンク経由で各言語版のPVを横断集計（海外人気の言語別）
// データは Wikimedia REST（wikimedia.org・無認証）。タイトル解決に ja.wikipedia.org / wikidata.org を使用。
// Playwright request（プロキシ対応）で取得する。
import { request } from 'playwright';

let RC;
async function rc() {
  if (!RC) RC = await request.newContext({
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'user-agent': 'artist-analytics/1.0 (SME analytics)' },
  });
  return RC;
}
export async function disposeWiki() { if (RC) { await RC.dispose(); RC = null; } }
async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await (await rc()).get(url, { timeout: 30000 }); if (r.ok()) return r.json(); }
    catch {}
    await new Promise(res => setTimeout(res, 600 * (i + 1)));
  }
  return { __err: 'failed' };
}

const pad = n => String(n).padStart(2, '0');
const yyyymmdd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
function range(days) { const end = new Date(); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1); return [start, end]; }

async function pv(project, title, days) {
  const [start, end] = range(days);
  const art = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${art}/daily/${yyyymmdd(start)}00/${yyyymmdd(end)}00`;
  const j = await getJson(url);
  return (j.items || []).map(x => ({ date: `${x.timestamp.slice(0, 4)}-${x.timestamp.slice(4, 6)}-${x.timestamp.slice(6, 8)}`, v: x.views }));
}

export async function jpDaily(title, days = 90, project = 'ja.wikipedia') {
  return { title, project, series: await pv(project, title, days) };
}

export async function langviews(title, days = 30, baseProject = 'ja.wikipedia') {
  // 1) wikibase_item
  const q = `https://${baseProject}.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const pj = await getJson(q);
  const qid = pj?.query?.pages?.[0]?.pageprops?.wikibase_item;
  if (!qid) return { qid: null, langs: [], error: 'wikidata item not found (host may be blocked)' };
  // 2) サイトリンク
  const we = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&format=json`;
  const wj = await getJson(we);
  const links = wj?.entities?.[qid]?.sitelinks || {};
  const targets = Object.entries(links)
    .filter(([site]) => /^[a-z-]+wiki$/.test(site) && !/commonswiki|metawiki|specieswiki/.test(site))
    .map(([site, v]) => ({ lang: site.replace(/wiki$/, ''), title: v.title }));
  // 3) 各言語版PV（wikimedia.org 経由）
  const out = [];
  for (const t of targets) {
    const s = await pv(`${t.lang}.wikipedia`, t.title, days);
    const total = s.reduce((a, x) => a + x.v, 0);
    if (total > 0) out.push({ lang: t.lang, title: t.title, total });
    await new Promise(r => setTimeout(r, 350)); // wikimedia REST のレート制限対策
  }
  out.sort((a, b) => b.total - a.total);
  return { qid, days, langs: out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const title = process.argv[2] || 'Creepy_Nuts';
  const jp = await jpDaily(title, 30);
  console.log(`[ja PV] ${title}: ${jp.series.length}日, 直近5日= ${jp.series.slice(-5).map(x => x.v).join(',')}`);
  const lv = await langviews(title, 30);
  console.log(`[langviews] qid=${lv.qid} 言語数=${lv.langs.length}${lv.error ? ' err=' + lv.error : ''}`);
  for (const l of lv.langs.slice(0, 8)) console.log(`  ${l.lang}: ${l.total.toLocaleString()} (${l.title})`);
  await disposeWiki();
}
