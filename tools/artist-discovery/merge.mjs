#!/usr/bin/env node
// Merge comment screening with channel metadata; keep Japanese-artist channels.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ranked = JSON.parse(readFileSync("ranked.json", "utf8"));
const meta = JSON.parse(readFileSync("chmeta.json", "utf8")).concat(
  existsSync("chmeta2.json") ? JSON.parse(readFileSync("chmeta2.json", "utf8")) : []
);
const byId = new Map(meta.filter(Boolean).map((m) => [m.id, m]));

const JA = /[぀-ゟ゠-ヿ一-鿿]/;
// compilation / playlist / non-artist channels
const NOT_ARTIST =
  /playlist|プレイリスト|作業用|bgm|relax|lofi|chill|mix\b|compilation|best of|カラオケ|karaoke|オルゴール|music box|翻訳|反応|reaction|shorts?集|まとめ|名曲|歌詞|lyrics?\b|睡眠|study|ランキング|集めました|hits?\b|radio|channel of|音楽 ?チャンネル/i;
// label / agency / management signals in the description
const LABEL =
  /レーベル|事務所|所属|マネジメント|management|booking|label|records?\b|entertainment|エンタテインメント|エンターテインメント|プロダクション|production(?!s? by me)|株式会社|公式|official (?:site|channel) of|universal|sony|avex|victor|warner|king ?record|pony ?canyon|nippon columbia/i;

const out = [];
for (const r of ranked) {
  const m = byId.get(r.id) || {};
  const desc = m.desc || "";
  const title = m.title || r.title || "";
  const jaTitle = JA.test(title);
  const jaVids = r.vids.filter((v) => JA.test(v.t)).length;
  const jaContent = jaVids >= Math.max(1, Math.ceil(r.vids.length / 2));
  const notArtist = NOT_ARTIST.test(title) || NOT_ARTIST.test(desc);
  const labelHit = (desc.match(LABEL) || [])[0] || null;
  out.push({
    ...r,
    handle: m.handle,
    url: m.handle ? `https://www.youtube.com/${m.handle}` : `https://www.youtube.com/channel/${r.id}`,
    country: m.country,
    desc: desc.replace(/\s+/g, " ").slice(0, 260),
    links: m.links,
    jaTitle,
    jaVids,
    jaContent,
    notArtist,
    labelHit,
    japaneseArtist: (jaTitle || jaContent) && !notArtist,
  });
}

writeFileSync("merged.json", JSON.stringify(out, null, 1));

const hits = out
  .filter((o) => o.japaneseArtist && o.overseasPct >= 35 && o.subs && o.subs <= 1200000)
  .sort((a, b) => b.overseasPct - a.overseasPct);

console.log(`# Japanese-artist channels with high overseas comment share: ${hits.length}\n`);
for (const h of hits) {
  console.log(
    `${String(h.overseasPct).padStart(5)}% | subs ${String(h.subs ?? "?").padStart(8)} | top ${String(
      h.topViews ?? "?"
    ).padStart(9)} | ${h.title} | ${h.url}`
  );
  console.log(`        langs=${JSON.stringify(h.langs)} label=${h.labelHit || "-"}`);
  console.log(`        top: ${h.topVideo?.t || ""}`);
  if (h.desc) console.log(`        desc: ${h.desc.slice(0, 150)}`);
  console.log("");
}
