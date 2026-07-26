#!/usr/bin/env node
// Wave 3: query in the languages of the audiences we are screening FOR.
// What SEA / LATAM / KR viewers can find is exactly the pool we want.
import { search } from "./yt.mjs";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const QUERIES = [
  // Indonesian / Malay
  "penyanyi jepang cover lagu", "cover lagu jepang gitar akustik penyanyi jepang",
  "penyanyi jepang suara merdu", "musisi indie jepang lagu original",
  // Thai
  "นักร้องญี่ปุ่น cover เพลง", "เพลงญี่ปุ่น cover กีตาร์ นักร้องญี่ปุ่น",
  // Filipino / English-PH
  "japanese singer cover viral philippines", "japanese street singer cover song viral",
  // Spanish / Portuguese
  "cantante japonesa cover cancion", "cantante japones voz increible cover",
  "cantora japonesa cover musica", "musica japonesa cover violao cantora",
  // Korean
  "일본 가수 커버 노래", "일본 싱어송라이터 커버 기타", "시티팝 커버 일본",
  // Vietnamese
  "ca sĩ nhật bản cover", "nhạc nhật cover guitar",
  // Chinese
  "日本 素人 唱歌 翻唱 吉他", "日本 女生 翻唱 城市流行",
  // Hindi / Arabic-facing English
  "japanese singer cover song india fans", "japanese singer voice arabic subtitles cover",
  // Russian
  "японская певица кавер", "японский исполнитель кавер гитара",
  // more English angles
  "japanese singer covers 80s song", "japanese girl covers bruno mars",
  "japanese singer covers taylor swift", "japanese singer covers beatles",
  "japanese singer covers frank sinatra jazz", "japanese girl sings soul cover",
  "japanese singer live house original song", "japanese songwriter home studio original",
  "japanese girl acoustic english cover bedroom", "japanese man singing english cover piano",
  "japanese kid singing cover amazing", "japanese singer discovered youtube talent",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = existsSync("candidates.json")
  ? new Map(JSON.parse(readFileSync("candidates.json", "utf8")).map((c) => [c.id, c]))
  : new Map();

for (const q of QUERIES) {
  try {
    const { videos } = await search(q);
    for (const v of videos) {
      if (!v.channelId) continue;
      const e = store.get(v.channelId) || { id: v.channelId, title: v.channel, hits: 0, vids: [], queries: [] };
      e.hits++;
      if (!e.queries.includes(q)) e.queries.push(q);
      if (e.vids.length < 6) e.vids.push({ id: v.videoId, t: v.title, views: v.views, pub: v.published });
      store.set(v.channelId, e);
    }
    process.stderr.write(`. ${q} -> ${videos.length} (ch ${store.size})\n`);
  } catch (e) {
    process.stderr.write(`! ${q}: ${e.message}\n`);
  }
  await sleep(200);
}
writeFileSync("candidates.json", JSON.stringify([...store.values()], null, 1));
console.log(`total channels: ${store.size}`);
