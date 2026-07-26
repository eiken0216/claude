#!/usr/bin/env node
// Stage 2: sample comments on each candidate's top videos; derive subs from the
// watch-page payload and compute the overseas-comment ratio.
import { comments, overseasRatio } from "./yt.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const all = JSON.parse(readFileSync("candidates.json", "utf8"));
const prev = existsSync("screened.json") ? JSON.parse(readFileSync("screened.json", "utf8")) : [];
const done = new Set(prev.filter((p) => p && !p.error).map((p) => p.id));
const cands = all.filter((c) => !done.has(c.id));
process.stderr.write(`new to screen: ${cands.length} (already ${done.size})\n`);

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx], idx);
        } catch (e) {
          out[idx] = { id: items[idx].id, error: e.message };
        }
      }
    })
  );
  return out;
}

const res = await pool(cands, 6, async (c, i) => {
  if (i % 20 === 0) process.stderr.write(`${i}/${cands.length}\n`);
  const top = [...c.vids].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 2);
  let all = [];
  let vmeta = null;
  for (const v of top) {
    const r = await comments(v.id, 60, "en", "US");
    if (!vmeta) vmeta = r.meta;
    all = all.concat(r.comments);
  }
  const ratio = overseasRatio(all);
  return {
    id: c.id,
    title: c.title,
    subs: vmeta?.subs ?? null,
    topVideo: top[0],
    topViews: top[0]?.views ?? null,
    sampled: ratio.n,
    overseasPct: ratio.overseas,
    langs: ratio.counts,
    queries: c.queries,
    vids: c.vids.slice(0, 4),
    exampleComments: all.filter((x) => ["latin", "ko", "th", "ru", "ar", "hi", "zh"].includes(
      (function (t) {
        const s = t || "";
        if (/[가-힯]/.test(s)) return "ko";
        if (/[฀-๿]/.test(s)) return "th";
        if (/[Ѐ-ӿ]/.test(s)) return "ru";
        if (/[؀-ۿ]/.test(s)) return "ar";
        if (/[ऀ-ॿ]/.test(s)) return "hi";
        if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";
        if (/[一-鿿]/.test(s)) return "zh";
        if (/[A-Za-z]{3,}/.test(s)) return "latin";
        return "other";
      })(x.text)
    )).slice(0, 4).map((x) => x.text.slice(0, 160)),
  };
});

const res2 = prev.filter((p) => p && !p.error).concat(res);
writeFileSync("screened.json", JSON.stringify(res2, null, 1));
const ranked = res2
  .filter((r) => r && !r.error && r.sampled >= 25 && r.overseasPct != null)
  .sort((a, b) => b.overseasPct - a.overseasPct);
writeFileSync("ranked.json", JSON.stringify(ranked, null, 1));
console.log(`screened ${res2.length}, usable ${ranked.length}\n`);
for (const r of ranked.filter((r) => r.overseasPct >= 30).slice(0, 100)) {
  console.log(
    `${String(r.overseasPct).padStart(5)}%  subs=${String(r.subs ?? "?").padStart(8)}  topViews=${String(r.topViews ?? "?").padStart(9)}  ${r.title}  ${JSON.stringify(r.langs)}`
  );
}
