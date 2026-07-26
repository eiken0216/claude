#!/usr/bin/env node
// Screen everything the crawler collected: video stats + comment-language mix.
// Reuses crawl.json so we only pay for the stats/comments calls.
import { videoStats, comments, langMix } from "./tt.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const crawl = JSON.parse(readFileSync("crawl.json", "utf8"));
const already = new Set(
  (existsSync("tt_all.json") ? JSON.parse(readFileSync("tt_all.json", "utf8")) : []).map((r) => r.h)
);
const done = existsSync("dance_screened.json")
  ? JSON.parse(readFileSync("dance_screened.json", "utf8"))
  : [];
const doneSet = new Set(done.map((d) => d.handle));

const JA = /[぀-ゟ゠-ヿ一-鿿]/;
const cands = Object.values(crawl).filter(
  (c) =>
    c &&
    !c.error &&
    !already.has(c.handle) &&
    !doneSet.has(c.handle) &&
    c.followers >= 2000 &&
    c.followers <= 8_000_000 &&
    c.vids?.length
);
process.stderr.write(`screening ${cands.length}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [...done];
let i = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (i < cands.length) {
      const idx = i++;
      const c = cands[idx];
      if (idx % 10 === 0) process.stderr.write(`${idx}/${cands.length}\n`);
      try {
        const stats = [];
        for (const id of c.vids.slice(0, 5)) {
          const s = await videoStats(c.handle, id);
          if (s) stats.push(s);
          await sleep(200);
        }
        if (!stats.length) {
          out.push({ handle: c.handle, nickname: c.nickname, followers: c.followers, error: "no stats" });
          continue;
        }
        stats.sort((a, b) => b.play - a.play);
        let cs = [];
        for (const s of stats.slice(0, 2)) cs = cs.concat(await comments(s.id, 50));
        const mix = langMix(cs);
        out.push({
          handle: c.handle,
          nickname: c.nickname,
          signature: c.signature,
          verified: c.verified,
          bioLink: c.bioLink,
          followers: c.followers,
          topPlay: stats[0].play,
          playPerFollower: +(stats[0].play / c.followers).toFixed(1),
          topDesc: stats[0].desc,
          sampled: mix.n,
          overseasPct: mix.overseas,
          langs: mix.counts,
          jaProfile: JA.test(`${c.nickname} ${c.signature || ""}`),
          topComments: cs
            .filter((x) => x.lang && x.lang !== "ja")
            .sort((a, b) => (b.likes || 0) - (a.likes || 0))
            .slice(0, 3)
            .map((x) => `[${x.lang}] ${x.text.slice(0, 100)}`),
        });
      } catch (e) {
        out.push({ handle: c.handle, error: e.message });
      }
    }
  })
);

writeFileSync("dance_screened.json", JSON.stringify(out, null, 1));
const ok = out
  .filter((o) => !o.error && o.overseasPct != null && o.sampled >= 20)
  .sort((a, b) => b.overseasPct - a.overseasPct);
for (const o of ok)
  console.log(
    `${String(o.overseasPct).padStart(5)}% fol=${String(o.followers).padStart(9)} top=${String(
      o.topPlay
    ).padStart(10)} x${String(o.playPerFollower).padStart(7)} ja=${o.jaProfile ? 1 : 0} @${o.handle} ${o.nickname} ${JSON.stringify(o.langs)}`
  );
console.log(`\ntotal ${out.length}, usable ${ok.length}`);
