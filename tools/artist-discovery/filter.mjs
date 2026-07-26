#!/usr/bin/env node
// Stricter nationality/independence filter over merged.json, plus a check of the
// channel's actual uploads (search-derived titles are query-biased).
import { channelVideos } from "./yt.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const merged = JSON.parse(readFileSync("merged.json", "utf8"));
const KANA = /[぀-ゟ゠-ヿ]/;
const HANGUL = /[가-힯ᄀ-ᇿ]/;
const CYR = /[Ѐ-ӿ]/;
const THAI = /[฀-๿]/;
const HAN = /[一-鿿]/;
const FOREIGN_DESC =
  /\b(saya|kami|kalian|lagu|terus|selamat|datang|xin chào|mình|của|bạn|canal|cantante|cantora|musica|música|canción|inscreva|olá|hola|amigos|привет|подписывайтесь|欢迎订阅|訂閱|频道|頻道|我是來自|안녕하세요|구독|채널)\b/i;

const pre = merged.filter(
  (m) =>
    m.overseasPct != null &&
    m.overseasPct >= 35 &&
    !m.notArtist &&
    m.subs &&
    m.subs <= 1_200_000 &&
    m.sampled >= 25
);

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx], idx);
        } catch {
          out[idx] = null;
        }
      }
    })
  );
  return out;
}

const cacheFile = "uploads.json";
let cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
const need = pre.filter((p) => !cache[p.id]);
process.stderr.write(`fetching uploads for ${need.length} channels\n`);
const got = await pool(need, 6, async (p) => ({ id: p.id, v: await channelVideos(p.id, "popular") }));
for (const g of got) if (g) cache[g.id] = g.v.slice(0, 20).map((x) => ({ t: x.title, views: x.views }));
writeFileSync(cacheFile, JSON.stringify(cache));

const rows = [];
for (const m of pre) {
  const ups = cache[m.id] || [];
  const titles = ups.map((u) => u.t);
  const kanaTitles = titles.filter((t) => KANA.test(t)).length;
  const kanaRatio = titles.length ? kanaTitles / titles.length : null;
  const blob = `${m.title} ${m.desc}`;
  const foreign =
    HANGUL.test(blob) || CYR.test(blob) || THAI.test(blob) || FOREIGN_DESC.test(m.desc || "");
  const kanaSelf = KANA.test(blob);
  // Japanese artist: kana in their own naming/description, or their uploads are
  // overwhelmingly Japanese-titled, and nothing foreign-language in the profile.
  const japanese = !foreign && (kanaSelf || (kanaRatio != null && kanaRatio >= 0.6));
  if (!japanese) continue;
  rows.push({
    ...m,
    kanaRatio: kanaRatio == null ? null : +kanaRatio.toFixed(2),
    uploads: ups.slice(0, 5),
    upTop: ups[0]?.views ?? null,
  });
}
rows.sort((a, b) => b.overseasPct - a.overseasPct);
writeFileSync("final_yt.json", JSON.stringify(rows, null, 1));
console.log(`# Japanese artist channels, overseas comments >= 35%: ${rows.length}\n`);
for (const r of rows) {
  console.log(
    `${String(r.overseasPct).padStart(5)}% | subs ${String(r.subs).padStart(7)} | topViews ${String(
      r.topViews ?? "?"
    ).padStart(9)} | kana ${r.kanaRatio} | ${r.title}`
  );
  console.log(`      ${r.url}  langs=${JSON.stringify(r.langs)}  label=${r.labelHit || "-"}`);
  console.log(`      desc: ${(r.desc || "").slice(0, 130)}`);
  console.log(`      up: ${r.uploads.map((u) => `${u.t} (${u.views})`).slice(0, 3).join(" | ")}`);
  console.log("");
}
