#!/usr/bin/env node
// Wave 2: much wider query sweep, run against both the JP and the US front end
// (the same query surfaces different channels depending on gl/hl).
import { search } from "./yt.mjs";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const JP = [
  "弾き語り カバー", "ピアノ弾き語り カバー", "歌ってみた 弾き語り", "オリジナル曲 弾き語り",
  "路上ライブ 弾き語り", "アコースティック カバー 日本人", "シティポップ カバー 弾き語り",
  "昭和歌謡 カバー 女性", "洋楽 カバー 日本人 女性", "洋楽 カバー 日本人 男性",
  "英語 カバー 日本人 歌ってみた", "英語で歌ってみた", "日本語で歌ってみた 洋楽",
  "弾き語り 女子高生", "ギター 弾き語り オリジナル曲", "インディーズ バンド オリジナル曲 MV",
  "自主制作 MV バンド 日本", "ピアノ 弾き語り オリジナル", "アカペラ 歌ってみた 日本人",
  "ウクレレ 弾き語り カバー", "ストリートピアノ 弾き語り", "駅前 路上ライブ 歌",
  "宅録 シンガーソングライター", "無名 歌うま 弾き語り", "歌声 綺麗 カバー 日本",
  "ジャズ ボーカル 日本人 若手", "ネオソウル 日本 シンガー", "R&B 日本人 シンガー カバー",
  "ボサノバ 日本人 女性 ボーカル", "フォーク 弾き語り 若手",
  "シティポップ 新曲 インディー", "和製シティポップ 新人", "80年代 カバー 女性ボーカル",
  "松原みき 真夜中のドア カバー", "竹内まりや カバー 弾き語り", "山下達郎 カバー 歌ってみた",
  "中森明菜 カバー 歌ってみた", "松田聖子 カバー 歌ってみた", "美空ひばり カバー 若手",
  "藤井風 カバー 弾き語り", "米津玄師 カバー 弾き語り 女性", "宇多田ヒカル カバー 弾き語り",
  "King Gnu カバー 歌ってみた", "back number カバー 弾き語り 女性",
  "ヨルシカ カバー 歌ってみた", "あいみょん カバー 弾き語り",
  "オリジナル曲 MV 一人 制作", "デモ 弾き語り オリジナル 新曲",
];
const EN = [
  "japanese girl singing cover", "japanese acoustic cover singer", "japanese street singer busking",
  "japanese piano singer cover", "city pop cover japanese singer", "japanese singer covers english song",
  "japanese indie singer songwriter original", "japanese girl guitar cover english",
  "japanese soul singer cover", "japanese singer sings in english cover",
  "japanese boy singing cover guitar", "japanese jazz singer young",
  "japanese band original song indie", "japanese singer piano original song",
  "japan busking street performance singer", "showa kayo cover japanese girl",
  "japanese r&b singer cover", "japanese singer amazing voice unknown",
  "mayonaka no door stay with me cover japanese", "plastic love cover japanese singer",
  "japanese girl sings english song perfectly", "japanese teenage singer songwriter",
  "japanese female vocalist bedroom cover", "japanese lofi singer original",
  "japanese singer tiktok viral cover", "japanese anime song acoustic cover singer",
  "japanese duo acoustic cover", "japanese high school band original",
  "japanese singer covers western song guitar", "japanese voice heavenly cover song",
  "japanese singer no label independent", "japanese bedroom pop artist",
  "japanese city pop new artist 2026", "japanese singer songwriter debut original song",
  "japanese girl band original song live house", "japanese vocalist cover viral",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = existsSync("candidates.json")
  ? new Map(JSON.parse(readFileSync("candidates.json", "utf8")).map((c) => [c.id, c]))
  : new Map();

async function sweep(list, label) {
  for (const q of list) {
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
      process.stderr.write(`. [${label}] ${q} -> ${videos.length} (ch ${store.size})\n`);
    } catch (e) {
      process.stderr.write(`! ${q}: ${e.message}\n`);
    }
    await sleep(200);
  }
}

await sweep(JP, "jp");
await sweep(EN, "en");
writeFileSync("candidates.json", JSON.stringify([...store.values()], null, 1));
console.log(`total channels: ${store.size}`);
