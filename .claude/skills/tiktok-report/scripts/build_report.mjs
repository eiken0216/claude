#!/usr/bin/env node
// Turn a raw scrape JSON snapshot into:
//   - metrics.csv          per-video metrics table (-> Google Sheet)
//   - comments.csv         top comments across the tracked videos (-> Google Sheet)
//   - account_history.csv  appended account-level time series (day over day)
//   - <date>.md            human-readable Markdown report with trends
//
// Usage:
//   node build_report.mjs --in raw.json --outdir ./reports/<handle> [--date YYYY-MM-DD]
//
// Trend detection compares the current account snapshot against the most
// recent previous row already stored in account_history.csv.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") a.in = argv[++i];
    else if (argv[i] === "--outdir") a.outdir = argv[++i];
    else if (argv[i] === "--date") a.date = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args.in || !args.outdir) {
  console.error("usage: node build_report.mjs --in raw.json --outdir ./reports/<handle> [--date YYYY-MM-DD]");
  process.exit(2);
}

const data = JSON.parse(readFileSync(args.in, "utf8"));
const date = args.date || new Date().toISOString().slice(0, 10);
const handle = data.handle;

mkdirSync(args.outdir, { recursive: true });

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
const fmt = (n) => (n == null ? "" : Number(n).toLocaleString("en-US"));
const engagement = (v) => {
  // (likes + comments + shares + saves) / views, as a percentage.
  if (!v.views) return null;
  const e = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0) + (v.saves ?? 0);
  return (e / v.views) * 100;
};

// ---------------------------------------------------------------------------
// 1. metrics.csv
// ---------------------------------------------------------------------------
const metricHeader = [
  "date", "video_id", "posted", "views", "likes", "comments",
  "shares", "saves", "engagement_%", "description", "url",
];
const metricRows = [metricHeader];
for (const v of data.videos) {
  const posted = v.createTime
    ? new Date(v.createTime * 1000).toISOString().slice(0, 10)
    : "";
  const eng = engagement(v);
  metricRows.push([
    date, v.id, posted, v.views, v.likes, v.comments, v.shares, v.saves,
    eng == null ? "" : eng.toFixed(2),
    (v.desc || "").replace(/\s+/g, " ").slice(0, 200), v.url,
  ]);
}
writeFileSync(join(args.outdir, "metrics.csv"), toCsv(metricRows));

// ---------------------------------------------------------------------------
// 2. comments.csv
// ---------------------------------------------------------------------------
const commentHeader = ["date", "video_id", "comment_likes", "author", "comment"];
const commentRows = [commentHeader];
for (const v of data.videos) {
  for (const c of v.topComments || []) {
    commentRows.push([
      date, v.id, c.likes, c.author,
      (c.text || "").replace(/\s+/g, " "),
    ]);
  }
}
writeFileSync(join(args.outdir, "comments.csv"), toCsv(commentRows));

// ---------------------------------------------------------------------------
// 3. account_history.csv  (append one row per run)
// ---------------------------------------------------------------------------
const historyPath = join(args.outdir, "account_history.csv");
const acct = data.account || {};
const totalViews = data.videos.reduce((s, v) => s + (v.views ?? 0), 0);
const totalLikes = data.videos.reduce((s, v) => s + (v.likes ?? 0), 0);
const historyHeader = [
  "date", "followers", "total_likes", "video_count",
  "tracked_videos", "tracked_views_sum", "tracked_likes_sum",
];
let prevRow = null;
if (existsSync(historyPath)) {
  const lines = readFileSync(historyPath, "utf8").trim().split("\n");
  const last = lines[lines.length - 1];
  if (last && !last.startsWith("date,")) {
    const cols = last.split(",");
    prevRow = { date: cols[0], followers: Number(cols[1]), total_likes: Number(cols[2]) };
  }
} else {
  writeFileSync(historyPath, historyHeader.join(",") + "\n");
}
appendFileSync(
  historyPath,
  [
    date, acct.followers ?? "", acct.likes ?? "", acct.videoCount ?? "",
    data.videos.length, totalViews, totalLikes,
  ].join(",") + "\n"
);

// ---------------------------------------------------------------------------
// 4. Markdown report with trends
// ---------------------------------------------------------------------------
function delta(cur, prev) {
  if (cur == null || prev == null || Number.isNaN(prev)) return "";
  const d = cur - prev;
  const sign = d > 0 ? "+" : "";
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "→";
  return ` (${arrow} ${sign}${fmt(d)} vs ${prev0(prev)})`;
}
const prev0 = (n) => fmt(n);

const sortedByViews = [...data.videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
const sortedByEng = [...data.videos]
  .map((v) => ({ v, e: engagement(v) }))
  .filter((x) => x.e != null)
  .sort((a, b) => b.e - a.e);
const allComments = data.videos
  .flatMap((v) => (v.topComments || []).map((c) => ({ ...c, videoId: v.id })))
  .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));

let md = `# TikTok レポート — @${handle}\n\n`;
md += `**生成日:** ${date}  \n`;
md += `**取得日時:** ${data.scrapedAt}\n\n`;

md += `## アカウント概要\n\n`;
if (data.account) {
  md += `- 名前: ${acct.nickname ?? "-"}${acct.verified ? " ✅" : ""}\n`;
  md += `- フォロワー: **${fmt(acct.followers)}**${prevRow ? delta(acct.followers, prevRow.followers) : ""}\n`;
  md += `- 総いいね: **${fmt(acct.likes)}**${prevRow ? delta(acct.likes, prevRow.total_likes) : ""}\n`;
  md += `- 投稿数: ${fmt(acct.videoCount)}\n`;
} else {
  md += `> ⚠️ アカウント統計を取得できませんでした（bot 対策の可能性）。\`TIKTOK_COOKIE\` を設定して再実行してください。\n`;
}
md += `\n`;

md += `## 今回取得した ${data.videos.length} 本の傾向\n\n`;
md += `- 合計再生数: **${fmt(totalViews)}**\n`;
md += `- 合計いいね: **${fmt(totalLikes)}**\n`;
const engVals = sortedByEng.map((x) => x.e);
if (engVals.length) {
  const avg = engVals.reduce((a, b) => a + b, 0) / engVals.length;
  md += `- 平均エンゲージメント率: **${avg.toFixed(2)}%**\n`;
}
md += `\n`;

md += `### 再生数トップ\n\n`;
md += `| # | 再生 | いいね | コメント | 保存 | エンゲージ | 説明 |\n`;
md += `|---|------|--------|----------|------|-----------|------|\n`;
sortedByViews.slice(0, 5).forEach((v, i) => {
  const e = engagement(v);
  md += `| ${i + 1} | ${fmt(v.views)} | ${fmt(v.likes)} | ${fmt(v.comments)} | ${fmt(v.saves)} | ${e == null ? "-" : e.toFixed(1) + "%"} | ${(v.desc || "").replace(/\|/g, "/").slice(0, 60)} |\n`;
});
md += `\n`;

if (sortedByEng.length) {
  md += `### エンゲージメント率トップ\n\n`;
  sortedByEng.slice(0, 3).forEach(({ v, e }) => {
    md += `- **${e.toFixed(1)}%** — ${fmt(v.views)} 再生 / ${fmt(v.saves)} 保存 — ${(v.desc || "").slice(0, 70)}  \n  ${v.url}\n`;
  });
  md += `\n`;
}

md += `## 注目コメント（いいね数上位）\n\n`;
if (allComments.length) {
  allComments.slice(0, 15).forEach((c) => {
    md += `- 👍 ${fmt(c.likes)} — *${(c.text || "").replace(/\n/g, " ").slice(0, 160)}* — ${c.author}\n`;
  });
} else {
  md += `> コメントを取得できませんでした。\n`;
}
md += `\n`;

if (data.warnings?.length) {
  md += `## 注意 / 警告\n\n`;
  for (const w of data.warnings) md += `- ${w}\n`;
  md += `\n`;
}

md += `---\n_metrics.csv / comments.csv は Google スプレッドシートとしても書き出されます。_\n`;

writeFileSync(join(args.outdir, `${date}.md`), md);

console.log(
  `report built in ${args.outdir}: ${date}.md, metrics.csv (${data.videos.length}), ` +
    `comments.csv (${commentRows.length - 1}), account_history.csv appended`
);
