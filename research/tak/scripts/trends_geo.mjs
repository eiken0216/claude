// Google Trends の「地域別の関心度」を取得する。
// 検索キーワードではなく Knowledge Graph のトピック ID（/g/...）を使うことで、
// 表記ゆれ・同名の別語（"PPPP" など）の混入を避ける。
// 使い方: node scripts/trends_geo.mjs "<mid>" "<ラベル>" [期間]
import fs from 'fs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const mid = process.argv[2];
const label = process.argv[3] ?? mid;
const time = process.argv[4] ?? 'today 12-m';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Trends は IP 単位で強めのレート制限がかかるため、長めのバックオフで粘る
async function gt(url, tries = 12) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, referer: 'https://trends.google.com/trends/explore' } });
      if (res.ok) {
        const t = await res.text();
        return JSON.parse(t.slice(t.indexOf('{')));
      }
      process.stderr.write(`  retry ${i + 1}/${tries} (HTTP ${res.status})\n`);
    } catch (e) {
      process.stderr.write(`  retry ${i + 1}/${tries} (${e.message})\n`);
    }
    await sleep(8000 + 7000 * i);
  }
  throw new Error(`Trends 取得失敗: ${url.slice(0, 90)}`);
}

const req = { comparisonItem: [{ keyword: mid, geo: '', time }], category: 0, property: '' };
const explore = await gt(`https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`);
const w = explore.widgets.find((x) => x.id === 'GEO_MAP');
if (!w) { console.error('GEO_MAP ウィジェットなし'); process.exit(1); }

await sleep(1500);
w.request.resolution = 'COUNTRY';
w.request.includeLowSearchVolumeGeos = true;
const geo = await gt(`https://trends.google.com/trends/api/widgetdata/comparedgeo?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(w.request))}&token=${w.token}`);

const rows = (geo.default?.geoMapData ?? [])
  .filter((r) => r.hasData?.[0] && r.value?.[0] > 0)
  .map((r) => ({ code: r.geoCode, name: r.geoName, value: r.value[0] }))
  .sort((a, b) => b.value - a.value);

fs.mkdirSync('data/trends', { recursive: true });
fs.writeFileSync(`data/trends/${label.replace(/\W+/g, '_')}.json`, JSON.stringify({ mid, label, time, rows }, null, 1));
console.log(`\n=== ${label} (${time}) 地域別の関心度 ===`);
rows.slice(0, 20).forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.code ?? '--'} ${r.name.padEnd(24)} ${r.value}`));
