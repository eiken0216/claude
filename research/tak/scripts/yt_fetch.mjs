// TAK (@TAK_DRDR) の YouTube 動画メタ + コメントを収集する。
// watch ページは datacenter IP だと 429 になるため、InnerTube API を直接叩く。
// 使い方: node scripts/yt_fetch.mjs <videoId> <目標コメント数> <出力json> [order]
//   order: 'top'（既定, relevance）| 'new'（新着順）
import fs from 'fs';

const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // YouTube web クライアントの公開キー
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CTX = { client: { clientName: 'WEB', clientVersion: '2.20240701.00.00', hl: 'en', gl: 'US' } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(endpoint, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${KEY}&prettyPrint=false`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': UA },
        body: JSON.stringify({ context: CTX, ...body }),
      });
      if (res.ok) return res.json();
    } catch { /* リトライ */ }
    await sleep(1000 * 2 ** i);
  }
  return null;
}

// 深さ優先で最初に見つかった continuation token を返す
function firstToken(o) {
  let t = null;
  const walk = (x) => {
    if (t || !x || typeof x !== 'object') return;
    const tok = x.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (tok) { t = tok; return; }
    if (Array.isArray(x)) x.forEach(walk); else Object.values(x).forEach(walk);
  };
  walk(o);
  return t;
}

function commentSection(o) {
  let s = null;
  const walk = (x) => {
    if (s || !x || typeof x !== 'object') return;
    if (x.itemSectionRenderer?.sectionIdentifier === 'comment-item-section') { s = x.itemSectionRenderer; return; }
    if (Array.isArray(x)) x.forEach(walk); else Object.values(x).forEach(walk);
  };
  walk(o);
  return s;
}

// コメント本文は frameworkUpdates の commentEntityPayload に入る
function harvest(json, out) {
  for (const m of json?.frameworkUpdates?.entityBatchUpdate?.mutations ?? []) {
    const c = m.payload?.commentEntityPayload;
    if (!c) continue;
    out.push({
      id: c.properties?.commentId,
      text: c.properties?.content?.content ?? '',
      author: c.author?.displayName ?? '',
      likes: c.toolbar?.likeCountNotliked ?? '0',
      replies: c.toolbar?.replyCount ?? '0',
      published: c.properties?.publishedTime ?? '',
    });
  }
  // 「次のページ」トークンは continuationItems 配列の末尾にある。
  // 深さ優先で拾うと返信スレッドのトークンを掴んでしまうため末尾を明示的に取る。
  let token = null;
  for (const ep of json?.onResponseReceivedEndpoints ?? []) {
    const items = ep.appendContinuationItemsAction?.continuationItems
               ?? ep.reloadContinuationItemsCommand?.continuationItems;
    if (!items?.length) continue;
    const last = items[items.length - 1];
    const tok = last?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (tok) token = tok;
  }
  return token;
}

const videoId = process.argv[2];
const target = parseInt(process.argv[3] ?? '600', 10);
const outPath = process.argv[4] ?? `data/raw/${videoId}.json`;
const order = process.argv[5] ?? 'top';

const next = await api('next', { videoId });
if (!next) { console.error(`${videoId}: next 取得失敗`); process.exit(1); }

const flat = JSON.stringify(next);
const meta = {
  videoId,
  title: next.contents?.twoColumnWatchNextResults?.results?.results?.contents
    ?.find((c) => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer?.title?.runs?.map((r) => r.text).join('') ?? null,
  views: flat.match(/"viewCount":\{"simpleText":"([\d,]+) views"/)?.[1]?.replace(/,/g, '') ?? null,
  publishDate: flat.match(/"dateText":\{"simpleText":"([^"]+)"/)?.[1] ?? null,
  commentCountShown: flat.match(/"commentCount":\{"simpleText":"([\d,]+)"/)?.[1] ?? null,
};

const sec = commentSection(next);
let token = firstToken(sec);

// 新着順にしたい場合は sortMenu の serviceEndpoint を使う
if (order === 'new') {
  const items = JSON.stringify(sec).match(/"sortFilterSubMenuRenderer":\{"subMenuItems":\[(.*?)\]/s);
  const tok = items?.[1]?.match(/"token":"(.*?)"/g)?.map((s) => s.slice(9, -1));
  if (tok && tok[1]) token = tok[1];
}

const comments = [];
for (let i = 0; token && comments.length < target && i < 80; i++) {
  const json = await api('next', { continuation: token });
  if (!json) break;
  const before = comments.length;
  token = harvest(json, comments);
  if (comments.length === before) break;
  process.stderr.write(`  ${videoId} [${order}]: ${comments.length}\r`);
  await sleep(300);
}

const seen = new Set();
const uniq = comments.filter((c) => c.id && !seen.has(c.id) && seen.add(c.id));
fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ meta, order, comments: uniq }, null, 1));
console.error(`\n${videoId} "${meta.title}" views=${meta.views} commentCount=${meta.commentCountShown} fetched=${uniq.length}`);
