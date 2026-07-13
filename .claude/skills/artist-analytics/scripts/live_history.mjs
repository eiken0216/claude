// ライブ・イベント履歴の自動収集（公演DB: eventernote.com）
//  - アーティスト名で actor を検索 → イベント一覧(日付/会場/イベント名)を取得
//  - 種別を推定（単独=ワンマン / フェス / 対バン等）
//  - 会場キャパは venues.json（別途照合の辞書）で部分一致付与
//
// 【重要な限界】eventernote はファン投稿DBで、フェス/大型イベントの網羅は強いが
//   単独公演(ワンマン)の登録が漏れることがある。キャパ到達分析(=ワンマン主体)では
//   Wikipedia/公式サイトでの補完が必要になる場合がある。取れた分のみ返し、捏造しない。
//
// 使い方: node live_history.mjs "imase"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { request } from 'playwright';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const VENUES = JSON.parse(fs.readFileSync(path.join(__dir, 'venues.json'), 'utf8')).venues;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

let RC;
async function rc() { if (!RC) RC = await request.newContext({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}), ignoreHTTPSErrors: true, extraHTTPHeaders: { 'user-agent': UA } }); return RC; }
export async function disposeLive() { if (RC) { await RC.dispose(); RC = null; } }
const getText = async (u) => { const r = await (await rc()).get(u, { timeout: 30000 }); return r.ok() ? r.text() : ''; };

export async function findActor(name) {
  const html = await getText(`https://www.eventernote.com/actors/search?keyword=${encodeURIComponent(name)}`);
  const cand = [];
  const seen = new Set();
  for (const m of html.matchAll(/\/actors\/([^\/"]+)\/(\d+)"[^>]*>([^<]*)/g)) {
    const slug = decodeURIComponent(m[1]), id = m[2], text = m[3].trim();
    if (['search', 'add', 'ranking'].includes(slug) || seen.has(id)) continue;
    seen.add(id); cand.push({ slug, id, name: text || slug });
  }
  // 確信できる一致＝表示名 or slug が完全一致（別人誤爆を防ぐ）
  const norm = s => (s || '').replace(/\s/g, '').toLowerCase();
  const best = cand.find(c => norm(c.name) === norm(name) || norm(c.slug) === norm(name)) || null;
  return { best, candidates: cand.slice(0, 8) };
}

function capacityOf(venue) {
  for (const v of VENUES) if (venue.includes(v.match)) return { cap: v.cap, fes: !!v.fes, matched: v.match };
  return { cap: null, fes: false, matched: null };
}
function classify(title) {
  if (/ワンマン|ONE ?MAN|単独|自主企画|主催/i.test(title)) return '単独';
  if (/FES|フェス|FESTIVAL|SONIC|ROCK IN|VIVA LA|COUNT ?DOWN|JAM|METROPOLITAN|WHEEL|BUNCH/i.test(title)) return 'フェス';
  if (/TOUR|ツアー/i.test(title)) return 'ツアー';
  if (/上映|先行上映|イベント|リリイベ|お渡し会/i.test(title)) return 'イベント';
  return '対バン/その他';
}

// name で自動解決（確信一致のみ）／曖昧なら候補を返す。actorId="slug/id" 明示指定も可。
export async function liveHistory(name, { actorId } = {}) {
  let actor;
  if (actorId) { const [slug, id] = actorId.split('/'); actor = { slug, id }; }
  else {
    const f = await findActor(name);
    if (!f.best) return { actor: null, events: [], ambiguous: true, candidates: f.candidates,
      note: `eventernoteで「${name}」に確信できる一致なし。別人の可能性。候補から actorId="slug/id" を指定するか、Wikipedia/公式で補完。` };
    actor = f.best;
  }
  const html = await getText(`https://www.eventernote.com/actors/${actor.slug}/${actor.id}/events?limit=300`);
  const blocks = html.match(/<li class="clearfix[^"]*">[\s\S]*?<\/li>/g) || [];
  const events = [];
  for (const b of blocks) {
    const d = b.match(/day0">(\d{4}-\d{2}-\d{2})/);
    if (!d) continue;
    const t = (b.match(/\/events\/\d+">([^<]+)<\/a>/) || [, ''])[1].replace(/&#39;/g, "'").trim();
    const v = (b.match(/\/places\/\d+">([^<]+)<\/a>/) || [, ''])[1].trim();
    const type = classify(t);
    const cap = capacityOf(v);
    // キャパ到達分析の対象は単独/ツアーのみ。フェス/イベントはキャパ非対象。
    const isFes = type === 'フェス' || cap.fes;
    events.push({ date: d[1], title: t, venue: v, type, capacity: isFes ? null : cap.cap, fes: isFes });
  }
  events.sort((a, b) => a.date < b.date ? -1 : 1);
  const oneman = events.filter(e => e.type === '単独' || e.type === 'ツアー');
  return {
    actor: `${actor.slug}/${actor.id}`,
    events,
    summary: { total: events.length, byType: events.reduce((o, e) => (o[e.type] = (o[e.type] || 0) + 1, o), {}), onemanCount: oneman.length,
      dateRange: events.length ? [events[0].date, events[events.length - 1].date] : null },
    caveat: '公演DB(eventernote)はフェス網羅が強く単独公演は漏れることがある。ワンマン/キャパ到達はWikipedia・公式で要補完。',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2] || 'imase';
  const r = await liveHistory(name, { actorId: process.argv[3] });
  if (r.ambiguous) { console.log('曖昧:', r.note); console.log('候補:'); r.candidates.forEach(c => console.log(`  ${c.slug}/${c.id}  ${c.name}`)); await disposeLive(); process.exit(0); }
  console.log('actor:', r.actor, '| events:', r.summary?.total, '| 種別:', JSON.stringify(r.summary?.byType));
  for (const e of (r.events || [])) console.log(`  ${e.date}  [${e.type}] ${e.venue}${e.capacity ? ' (Cap' + e.capacity + ')' : e.fes ? ' (フェス)' : ' (キャパ未照合)'}  ${e.title.slice(0, 40)}`);
  console.log('caveat:', r.caveat);
  await disposeLive();
}
