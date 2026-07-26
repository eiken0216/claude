#!/usr/bin/env node
// Discover YouTube music channels and screen them by overseas-comment ratio.
import { search, comments, channel, channelVideos, overseasRatio } from "./yt.mjs";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const QUERIES = [
  // --- Japanese-facing discovery
  "弾き語り カバー", "ピアノ弾き語り カバー", "歌ってみた 弾き語り", "オリジナル曲 弾き語り",
  "路上ライブ 弾き語り", "アコースティック カバー 日本人", "シティポップ カバー 弾き語り",
  "昭和歌謡 カバー 女性", "洋楽 カバー 日本人 女性", "洋楽 カバー 日本人 男性",
  "弾き語り 女子 高校生", "ギター 弾き語り オリジナル", "バンド オリジナル曲 インディーズ",
  "MV オリジナル曲 自主制作 バンド", "ピアノ 弾き語り オリジナル 曲",
  "cover 日本語 歌 うまい 無名", "路上ライブ 歌うまい 女性", "ボサノバ カバー 日本人",
  "ジャズ カバー 日本人 歌手 若手", "ネオソウル 日本人 シンガー",
  // --- Overseas-facing discovery (this is where 藤井風-type channels surface)
  "japanese girl singing cover", "japanese acoustic cover singer", "japanese street singer busking",
  "japanese piano singer cover", "city pop cover japanese singer", "japanese singer covers english song",
  "japanese indie singer songwriter original", "japanese girl guitar cover english",
  "unknown japanese singer amazing voice", "japanese soul singer cover",
  "japanese singer sings in english cover", "japanese boy singing cover guitar",
  "japanese jazz singer young", "japanese band original song indie",
  "japanese singer piano original song", "japan busking street performance singer",
  "showa kayo cover japanese girl", "japanese r&b singer cover",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const seen = new Map(); // channelId -> {title, hits, sampleVideos}
  for (const q of QUERIES) {
    try {
      const { videos } = await search(q);
      for (const v of videos) {
        if (!v.channelId) continue;
        const e = seen.get(v.channelId) || { title: v.channel, hits: 0, vids: [], queries: [] };
        e.hits++;
        if (!e.queries.includes(q)) e.queries.push(q);
        if (e.vids.length < 6) e.vids.push({ id: v.videoId, t: v.title, views: v.views, pub: v.published });
        seen.set(v.channelId, e);
      }
      process.stderr.write(`. ${q} -> ${videos.length} (total ch ${seen.size})\n`);
    } catch (e) {
      process.stderr.write(`! ${q}: ${e.message}\n`);
    }
    await sleep(250);
  }
  writeFileSync("candidates.json", JSON.stringify([...seen].map(([id, v]) => ({ id, ...v })), null, 1));
  console.log(`channels discovered: ${seen.size}`);
}
main();
