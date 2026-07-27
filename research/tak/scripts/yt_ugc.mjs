// TAK 楽曲の「二次創作（UGC）」が、どの言語圏で作られているかを測る。
// 歌ってみた・踊ってみた・カバー・リミックス・MMD 等は投稿タイトルとチャンネル名に
// 制作者の言語が出るため、UGC 側の国構成の代理指標になる。
import fs from 'fs';

const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CTX = { client: { clientName: 'WEB', clientVersion: '2.20240701.00.00', hl: 'en', gl: 'US' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(query, pages = 3) {
  const items = [];
  let token = null;
  for (let p = 0; p < pages; p++) {
    const body = token ? { continuation: token } : { query, params: 'EgIQAQ%3D%3D' }; // 動画のみ
    const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ context: CTX, ...body }),
    });
    if (!res.ok) break;
    const j = await res.json();
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (o.videoRenderer) {
        const v = o.videoRenderer;
        items.push({
          id: v.videoId,
          title: v.title?.runs?.map((r) => r.text).join('') ?? '',
          channel: v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text ?? '',
          views: v.viewCountText?.simpleText ?? '',
          published: v.publishedTimeText?.simpleText ?? '',
        });
      }
      if (Array.isArray(o)) o.forEach(walk); else Object.values(o).forEach(walk);
    };
    walk(j);
    let t = null;
    const findTok = (o) => {
      if (t || !o || typeof o !== 'object') return;
      const x = o.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (x) { t = x; return; }
      if (Array.isArray(o)) o.forEach(findTok); else Object.values(o).forEach(findTok);
    };
    findTok(j);
    token = t;
    if (!token) break;
    await sleep(400);
  }
  return items;
}

const QUERIES = [
  'PPPP TAK 歌ってみた', 'PPPP TAK cover', 'PPPP TAK 커버', 'PPPP TAK dance', 'PPPP TAK remix',
  'LEMON MELON COOKIE cover', 'LEMON MELON COOKIE 歌ってみた', 'LEMON MELON COOKIE 커버',
  'mochimochi TAK cover', '孤独サイコ 歌ってみた', 'numb numb TAK cover', 'TAK 初音ミク cover',
];

const all = [];
for (const q of QUERIES) {
  const r = await search(q, 3);
  console.error(`${q}: ${r.length}`);
  r.forEach((x) => all.push({ ...x, q }));
  await sleep(600);
}
const seen = new Set();
const uniq = all.filter((v) => v.id && !seen.has(v.id) && seen.add(v.id));
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/ugc_videos.json', JSON.stringify(uniq, null, 1));
console.error(`\n合計 ${uniq.length} 本のUGC候補を取得`);
