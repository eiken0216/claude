#!/usr/bin/env node
// Turn a raw Graph API snapshot (from fetch_insights.mjs) into:
//   - metrics.csv          per-media metrics table (-> Google Sheet)
//   - comments.csv         all comments + replies across tracked media (-> Sheet)
//   - audience.csv         account-level reached-audience country breakdown
//   - account_history.csv  appended account-level time series (run over run)
//   - <date>.md            human-readable Markdown report with trends
//
// Usage:
//   node build_report.mjs --in raw.json --outdir ./reports/<username> [--date YYYY-MM-DD]

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync,
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
  console.error("usage: node build_report.mjs --in raw.json --outdir ./reports/<username> [--date YYYY-MM-DD]");
  process.exit(2);
}

const data = JSON.parse(readFileSync(args.in, "utf8"));
const date = args.date || new Date().toISOString().slice(0, 10);
const acct = data.account || {};
const username = acct.username || "account";

mkdirSync(args.outdir, { recursive: true });

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const fmt = (n) => (n == null || n === "" ? "" : Number(n).toLocaleString("en-US"));
const num = (v) => (v == null ? null : Number(v));

// Pull a metric from a media's insights, tolerating naming differences.
function mv(m, ...names) {
  for (const n of names) {
    const v = m.insights?.[n];
    if (v != null) return Number(v);
  }
  return null;
}

// Effective "views/plays" for a media across product types.
const views = (m) => mv(m, "views", "ig_reels_aggregated_all_plays_count", "reach");
// Engagement = interactions / reach, as a percentage.
function engagement(m) {
  const reach = mv(m, "reach");
  const inter =
    mv(m, "total_interactions") ??
    ((mv(m, "likes") ?? 0) + (mv(m, "comments") ?? 0) +
      (mv(m, "shares") ?? 0) + (mv(m, "saved") ?? 0));
  if (!reach) return null;
  return (inter / reach) * 100;
}
// Avg watch time in seconds (API returns ms for reels).
const avgWatchS = (m) => {
  const ms = mv(m, "ig_reels_avg_watch_time");
  return ms == null ? null : ms / 1000;
};
const totalWatchS = (m) => {
  const ms = mv(m, "ig_reels_video_view_total_time");
  return ms == null ? null : ms / 1000;
};

// --------------------------------------------------------------------------
// 1. metrics.csv
// --------------------------------------------------------------------------
const metricHeader = [
  "date", "media_id", "type", "product_type", "posted", "reach", "views",
  "likes", "comments", "shares", "saved", "total_interactions",
  "engagement_%", "avg_watch_s", "total_watch_s", "caption", "permalink",
];
const metricRows = [metricHeader];
for (const m of data.media) {
  const posted = m.timestamp ? m.timestamp.slice(0, 10) : "";
  const eng = engagement(m);
  metricRows.push([
    date, m.id, m.type, m.productType, posted,
    mv(m, "reach"), views(m),
    mv(m, "likes") ?? m.likeCount, mv(m, "comments") ?? m.commentsCount,
    mv(m, "shares"), mv(m, "saved"), mv(m, "total_interactions"),
    eng == null ? "" : eng.toFixed(2),
    avgWatchS(m) == null ? "" : avgWatchS(m).toFixed(1),
    totalWatchS(m) == null ? "" : totalWatchS(m).toFixed(0),
    (m.caption || "").replace(/\s+/g, " ").slice(0, 200), m.permalink,
  ]);
}
writeFileSync(join(args.outdir, "metrics.csv"), toCsv(metricRows));

// --------------------------------------------------------------------------
// 2. comments.csv  (all comments + replies)
// --------------------------------------------------------------------------
const commentHeader = [
  "date", "media_id", "comment_id", "parent_id", "author", "likes", "posted", "comment",
];
const commentRows = [commentHeader];
for (const m of data.media) {
  for (const c of m.comments || []) {
    commentRows.push([
      date, m.id, c.id, c.parentId || "", c.author, c.likes,
      c.timestamp ? c.timestamp.slice(0, 10) : "",
      (c.text || "").replace(/\s+/g, " "),
    ]);
  }
}
writeFileSync(join(args.outdir, "comments.csv"), toCsv(commentRows));

// --------------------------------------------------------------------------
// 3. audience.csv  (account-level country breakdown)
// --------------------------------------------------------------------------
const audienceRows = [["date", "country", "audience"]];
for (const c of data.audience?.countries || []) {
  audienceRows.push([date, c.country, c.value]);
}
writeFileSync(join(args.outdir, "audience.csv"), toCsv(audienceRows));

// --------------------------------------------------------------------------
// 4. account_history.csv  (append one row per run)
// --------------------------------------------------------------------------
const historyPath = join(args.outdir, "account_history.csv");
const totalReach = data.media.reduce((s, m) => s + (mv(m, "reach") ?? 0), 0);
const totalLikes = data.media.reduce((s, m) => s + (mv(m, "likes") ?? m.likeCount ?? 0), 0);
const totalComments = data.media.reduce((s, m) => s + (m.comments?.length ?? 0), 0);
const historyHeader = [
  "date", "followers", "follows", "media_count",
  "tracked_media", "tracked_reach_sum", "tracked_likes_sum", "tracked_comments_sum",
];
let prevRow = null;
if (existsSync(historyPath)) {
  const lines = readFileSync(historyPath, "utf8").trim().split("\n");
  const last = lines[lines.length - 1];
  if (last && !last.startsWith("date,")) {
    const cols = last.split(",");
    prevRow = {
      date: cols[0], followers: Number(cols[1]),
      follows: Number(cols[2]), media_count: Number(cols[3]),
    };
  }
} else {
  writeFileSync(historyPath, historyHeader.join(",") + "\n");
}
appendFileSync(
  historyPath,
  [
    date, acct.followers_count ?? "", acct.follows_count ?? "", acct.media_count ?? "",
    data.media.length, totalReach, totalLikes, totalComments,
  ].join(",") + "\n"
);

// --------------------------------------------------------------------------
// 5. Markdown report
// --------------------------------------------------------------------------
function delta(cur, prev) {
  if (cur == null || prev == null || Number.isNaN(prev)) return "";
  const d = cur - prev;
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "→";
  const sign = d > 0 ? "+" : "";
  return ` (${arrow} ${sign}${fmt(d)} vs ${fmt(prev)})`;
}

const byViews = [...data.media].sort((a, b) => (views(b) ?? 0) - (views(a) ?? 0));
const byEng = data.media
  .map((m) => ({ m, e: engagement(m) }))
  .filter((x) => x.e != null)
  .sort((a, b) => b.e - a.e);
const allComments = data.media
  .flatMap((m) => (m.comments || []).map((c) => ({ ...c, mediaId: m.id })))
  .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));

let md = `# Instagram レポート — @${username}\n\n`;
md += `**生成日:** ${date}  \n`;
md += `**取得日時:** ${data.fetchedAt}  \n`;
md += `**API:** Instagram Graph API ${data.apiVersion}\n\n`;

md += `## アカウント概要\n\n`;
if (data.account) {
  md += `- 名前: ${acct.name ?? "-"}\n`;
  md += `- フォロワー: **${fmt(acct.followers_count)}**${prevRow ? delta(acct.followers_count, prevRow.followers) : ""}\n`;
  md += `- フォロー中: ${fmt(acct.follows_count)}${prevRow ? delta(acct.follows_count, prevRow.follows) : ""}\n`;
  md += `- 投稿数: ${fmt(acct.media_count)}${prevRow ? delta(acct.media_count, prevRow.media_count) : ""}\n`;
  if (acct.biography) md += `- プロフィール: ${acct.biography.replace(/\n/g, " ")}\n`;
} else {
  md += `> ⚠️ アカウント情報を取得できませんでした。トークン/権限を確認してください。\n`;
}
md += `\n`;

md += `## 今回取得した ${data.media.length} 投稿の傾向\n\n`;
md += `- 合計リーチ: **${fmt(totalReach)}**\n`;
md += `- 合計いいね: **${fmt(totalLikes)}**\n`;
md += `- 収集コメント数: **${fmt(totalComments)}**\n`;
const engVals = byEng.map((x) => x.e);
if (engVals.length) {
  const avg = engVals.reduce((a, b) => a + b, 0) / engVals.length;
  md += `- 平均エンゲージメント率(対リーチ): **${avg.toFixed(2)}%**\n`;
}
md += `\n`;

md += `### リーチ/再生 トップ\n\n`;
md += `| # | リーチ | 再生 | いいね | コメント | 保存 | エンゲージ | 平均視聴(秒) | 内容 |\n`;
md += `|---|--------|------|--------|----------|------|-----------|--------------|------|\n`;
byViews.slice(0, 8).forEach((m, i) => {
  const e = engagement(m);
  const w = avgWatchS(m);
  md += `| ${i + 1} | ${fmt(mv(m, "reach"))} | ${fmt(views(m))} | ${fmt(mv(m, "likes") ?? m.likeCount)} | ${fmt(mv(m, "comments") ?? m.commentsCount)} | ${fmt(mv(m, "saved"))} | ${e == null ? "-" : e.toFixed(1) + "%"} | ${w == null ? "-" : w.toFixed(1)} | ${(m.caption || "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 50)} |\n`;
});
md += `\n`;

if (byEng.length) {
  md += `### エンゲージメント率 トップ\n\n`;
  byEng.slice(0, 3).forEach(({ m, e }) => {
    md += `- **${e.toFixed(1)}%** — リーチ ${fmt(mv(m, "reach"))} / 保存 ${fmt(mv(m, "saved"))} — ${(m.caption || "").replace(/\n/g, " ").slice(0, 70)}  \n  ${m.permalink}\n`;
  });
  md += `\n`;
}

md += `## オーディエンスの国（アカウント全体・上位）\n\n`;
if (data.audience?.countries?.length) {
  md += `_指標: ${data.audience.metric}。※投稿単位の国別データは Graph API では提供されません。_\n\n`;
  md += `| 国 | オーディエンス |\n|----|----------------|\n`;
  data.audience.countries.slice(0, 10).forEach((c) => {
    md += `| ${c.country} | ${fmt(c.value)} |\n`;
  });
} else {
  md += `> 国別データを取得できませんでした（フォロワー100人未満、または権限不足の可能性）。\n`;
}
md += `\n`;

md += `## 注目コメント（いいね数上位）\n\n`;
if (allComments.length) {
  allComments.slice(0, 20).forEach((c) => {
    md += `- 👍 ${fmt(c.likes)} — *${(c.text || "").replace(/\n/g, " ").slice(0, 160)}* — @${c.author}\n`;
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

md += `---\n_metrics.csv / comments.csv / audience.csv は Google スプレッドシートとしても書き出せます。_\n`;

writeFileSync(join(args.outdir, `${date}.md`), md);

console.log(
  `report built in ${args.outdir}: ${date}.md, metrics.csv (${data.media.length}), ` +
    `comments.csv (${commentRows.length - 1}), audience.csv (${audienceRows.length - 1}), ` +
    `account_history.csv appended`
);
