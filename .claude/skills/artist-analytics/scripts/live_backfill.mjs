// 既存data.jsonに ライブ・イベント履歴(eventernote) を後付けする。GfK/クロノは触らない。
// 使い方: node live_backfill.mjs <data.json> "<アーティスト名>" ["<slug>/<id>"]
import fs from 'fs';
import { liveHistory, disposeLive } from './live_history.mjs';

const dataPath = process.argv[2], name = process.argv[3], actorId = process.argv[4];
if (!dataPath || !name) { console.error('usage: live_backfill.mjs <data.json> "<artist>" [slug/id]'); process.exit(1); }
const result = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
try {
  const r = await liveHistory(name, { actorId });
  result.sources.live = r;
  result.availability.live = r.ambiguous ? ('ambiguous: ' + (r.candidates || []).map(c => c.slug + '/' + c.id).join(',')) : (r.events?.length ? 'ok' : 'no-data');
  fs.writeFileSync(dataPath, JSON.stringify(result, null, 1));
  console.log('live:', result.availability.live, '| events:', r.events?.length || 0, '| actor:', r.actor, '| oneman:', r.summary?.onemanCount);
} catch (e) {
  result.availability.live = 'error:' + String(e).slice(0, 80);
  fs.writeFileSync(dataPath, JSON.stringify(result, null, 1));
  console.log('live error:', String(e).slice(0, 100));
}
await disposeLive();
process.exit(0);
