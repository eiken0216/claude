#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectArticles, fetchNewsMentions } from './sources/rss.mjs';
import { fetchArtistSnapshot, spotifyConfigured } from './sources/spotify.mjs';
import { fetchChannelSnapshot, fetchUgcSnapshot, youtubeConfigured } from './sources/youtube.mjs';
import { detectSpike, describeSpike } from './anomaly.mjs';
import { curate, curationConfigured } from './curate.mjs';
import { renderHtml, renderText, renderMarkdown } from './render.mjs';
import { sendMail, mailerConfigured, mailConfig } from './mailer.mjs';
import {
  readJson,
  readJsonl,
  appendJsonl,
  writeText,
  todayJST,
  weekdayJST,
  displayDateJST,
} from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(here, '..');
const repoRoot = path.resolve(toolRoot, '..', '..');
const dataRoot = path.join(repoRoot, 'data');

const DRY_RUN = process.argv.includes('--dry-run');

/** 追跡する指標の定義 */
const METRICS = [
  {
    key: 'spotify.followers',
    label: 'Spotify フォロワー',
    unit: '人',
    mode: 'delta',
    get: (h) => h.spotify?.followers,
  },
  {
    key: 'spotify.popularity',
    label: 'Spotify 人気度',
    unit: '',
    mode: 'level',
    get: (h) => h.spotify?.popularity,
  },
  {
    key: 'spotify.trackPopularity',
    label: 'トップ曲の平均人気度',
    unit: '',
    mode: 'level',
    get: (h) => h.spotify?.trackPopularity,
  },
  {
    key: 'youtube.subscribers',
    label: 'YouTube 登録者',
    unit: '人',
    mode: 'delta',
    get: (h) => h.youtube?.subscribers,
  },
  {
    key: 'youtube.views',
    label: 'YouTube 再生数',
    unit: '回',
    mode: 'delta',
    get: (h) => h.youtube?.views,
  },
  {
    key: 'ugc.uploads',
    label: 'UGC 24h投稿数',
    unit: '本',
    mode: 'level',
    get: (h) => h.ugc?.uploads,
  },
  {
    key: 'ugc.totalViews',
    label: 'UGC 24h再生数',
    unit: '回',
    mode: 'level',
    get: (h) => h.ugc?.totalViews,
  },
  {
    key: 'news.mentions',
    label: 'ニュース言及数(24h)',
    unit: '件',
    mode: 'level',
    get: (h) => h.news?.mentions,
  },
];

async function main() {
  const date = todayJST();
  const dateLabel = displayDateJST();
  const notes = [];

  console.log(`[daily-news] ${date} の配信を組み立てます${DRY_RUN ? '（ドライラン）' : ''}`);

  const artistConfig = await readJson(path.join(toolRoot, 'config', 'artists.json'));
  const feedConfig = await readJson(path.join(toolRoot, 'config', 'feeds.json'));

  // 月曜は土日ぶんを取りこぼさないよう遡る期間を延ばす
  const isMonday = weekdayJST() === 1;
  const lookbackHours = isMonday
    ? (feedConfig.mondayLookbackHours ?? 72)
    : (feedConfig.lookbackHours ?? 24);

  const [artists, feedResult] = await Promise.all([
    buildArtistSection(artistConfig, date, notes),
    collectArticles(feedConfig, { lookbackHours }),
  ]);

  const totalArticles = feedResult.categories.reduce((a, c) => a + c.articles.length, 0);
  console.log(
    `[daily-news] 記事 ${totalArticles} 件 / アーティスト ${artists.length} 組 / 過去${lookbackHours}時間`,
  );

  // Claude でキュレーション（失敗したら素の見出しに落とす）
  let curation = null;
  if (curationConfigured()) {
    try {
      curation = await curate({
        categories: feedResult.categories,
        artistSummary: artists.map((a) => a.promptSummary).join('\n'),
        dateLabel,
      });
      if (curation?.usage) {
        console.log(
          `[daily-news] キュレーション完了 (${curation.model}: in ${curation.usage.input_tokens} / out ${curation.usage.output_tokens} tokens)`,
        );
      }
    } catch (err) {
      console.warn('[daily-news] キュレーションに失敗しました:', err.message);
    }
  }
  if (!curation) {
    notes.push('AI要約は使われていません（ANTHROPIC_API_KEY 未設定、または API 呼び出しに失敗）。');
  }

  const sections = buildSections(feedResult.categories, curation);
  const spikeCount = artists.reduce((a, x) => a + x.spikes.length, 0);

  const report = {
    date,
    dateLabel,
    brief: curation?.brief ?? '',
    anomalyNote: curation?.anomalyNote ?? '',
    artists,
    sections,
    failures: feedResult.failures,
    meta: notes,
  };

  const html = renderHtml(report);
  const text = renderText(report);
  const markdown = renderMarkdown(report);

  const digestPath = path.join(dataRoot, 'digests', `${date}.md`);
  await writeText(digestPath, markdown);
  console.log(`[daily-news] レポートを書き出しました: ${path.relative(repoRoot, digestPath)}`);

  const subject = buildSubject({ dateLabel, spikeCount, artists, sections });

  if (DRY_RUN) {
    console.log(`\n件名: ${subject}\n`);
    console.log(text);
    console.log('\n[daily-news] ドライランのためメールは送信していません');
    return;
  }

  if (!mailerConfigured()) {
    console.warn('[daily-news] SMTP_USER / SMTP_PASS が未設定のため送信をスキップしました');
    return;
  }

  const result = await sendMail({ subject, html, text });
  console.log(
    `[daily-news] 送信しました → ${mailConfig().to.join(', ')} (messageId: ${result.messageId})`,
  );
}

/* ------------------------------------------------- アーティスト指標の収集 --- */

async function buildArtistSection(artistConfig, date, notes) {
  const targets = (artistConfig.artists ?? []).filter((a) => a.enabled !== false);
  if (targets.length === 0) {
    notes.push(
      '担当アーティストが未登録です。tools/news/config/artists.json に登録すると異常値検知が始まります。',
    );
    return [];
  }
  if (!spotifyConfigured()) {
    notes.push('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が未設定のため、Spotify 指標はスキップしました。');
  }
  if (!youtubeConfigured()) {
    notes.push('YOUTUBE_API_KEY が未設定のため、YouTube 指標と UGC 計測はスキップしました。');
  }

  const out = [];
  for (const artist of targets) {
    try {
      out.push(await buildArtistCard(artist, date));
    } catch (err) {
      console.warn(`[daily-news] ${artist.name} の指標取得に失敗:`, err.message);
      notes.push(`${artist.name} の指標取得に失敗しました: ${err.message}`);
    }
  }
  return out;
}

async function buildArtistCard(artist, date) {
  const slug = artist.slug || artist.name.replace(/\s+/g, '-').toLowerCase();
  const historyPath = path.join(dataRoot, 'artists', slug, 'history.jsonl');

  const snapshot = { date };
  const links = [];
  const errors = [];

  if (artist.spotifyId && spotifyConfigured()) {
    try {
      const s = await fetchArtistSnapshot(artist.spotifyId);
      snapshot.spotify = {
        followers: s.followers,
        popularity: s.popularity,
        trackPopularity: s.trackPopularity,
        topTracks: s.topTracks,
      };
      if (s.url) links.push({ label: 'Spotify', url: s.url });
    } catch (err) {
      errors.push(`Spotify: ${err.message}`);
    }
  }

  if (artist.youtubeChannelId && youtubeConfigured()) {
    try {
      const y = await fetchChannelSnapshot(artist.youtubeChannelId);
      snapshot.youtube = { subscribers: y.subscribers, views: y.views, videos: y.videos };
      links.push({ label: 'YouTube', url: y.url });
    } catch (err) {
      errors.push(`YouTube: ${err.message}`);
    }
  }

  const highlights = [];

  if (artist.ugc !== false && youtubeConfigured()) {
    try {
      const ugc = await fetchUgcSnapshot(artist.ugcQuery || artist.name, { hours: 24 });
      snapshot.ugc = { uploads: ugc.uploads, totalViews: ugc.totalViews };
      for (const v of ugc.top) {
        highlights.push({
          kind: 'YouTube',
          title: v.title,
          url: v.url,
          meta: `${v.channel} / ${v.views?.toLocaleString('ja-JP') ?? '—'}回`,
        });
      }
    } catch (err) {
      errors.push(`UGC: ${err.message}`);
    }
  }

  // ニュース言及はAPIキー不要。名前の露出量そのものを追う。
  if (artist.news !== false) {
    const news = await fetchNewsMentions(artist.newsQuery || `"${artist.name}"`, { hours: 24 });
    if (news.ok) {
      snapshot.news = { mentions: news.items.length };
      for (const item of news.items.slice(0, 3)) {
        highlights.push({
          kind: 'ニュース',
          title: item.title,
          url: item.link,
          meta: item.outlet || '',
        });
      }
    } else {
      errors.push(`ニュース: ${news.error}`);
    }
  }

  await appendJsonl(historyPath, snapshot);
  const history = await readJsonl(historyPath);

  const metrics = [];
  const spikes = [];
  const promptLines = [`- ${artist.name}`];

  for (const metric of METRICS) {
    const series = history
      .map((h) => ({ date: h.date, value: metric.get(h) }))
      .filter((p) => typeof p.value === 'number' && Number.isFinite(p.value));

    if (series.length === 0) continue;

    const result = detectSpike(series, { mode: metric.mode });
    const text = describeSpike(metric.label, result, { unit: metric.unit });

    metrics.push({ key: metric.key, text, spike: Boolean(result.isSpike), result });
    promptLines.push(`  - ${text}`);
    if (result.isSpike) {
      spikes.push({ key: metric.key, label: metric.label, result });
    }
  }

  for (const h of highlights) {
    promptLines.push(`  - [${h.kind}] 「${h.title}」${h.meta ? ` (${h.meta})` : ''}`);
  }
  for (const err of errors) promptLines.push(`  - 取得失敗 ${err}`);

  if (metrics.length === 0) {
    metrics.push({ key: 'none', text: '指標を取得できませんでした', spike: false });
  }
  for (const err of errors) {
    metrics.push({ key: 'error', text: `⚠ 取得失敗 — ${err}`, spike: false });
  }

  return {
    name: artist.name,
    slug,
    metrics,
    spikes,
    links,
    highlights,
    promptSummary: promptLines.join('\n'),
  };
}

/* ------------------------------------------------------ セクションの構築 --- */

function buildSections(categories, curation) {
  return categories.map((category) => {
    const curated = curation?.items.filter((i) => i.category === category.key) ?? [];

    if (curated.length > 0) {
      const items = curated
        .sort((a, b) => b.importance - a.importance)
        .map((i) => ({
          headline: i.headline_ja || i.article.title,
          summary: i.summary_ja,
          why: i.why_ja,
          importance: i.importance,
          source: i.article.source,
          published: i.article.published,
          link: i.article.link,
        }));
      return { key: category.key, label: category.label, items };
    }

    // AI要約が無いときは新着順の見出しだけを出す
    const items = category.articles.slice(0, 6).map((a) => ({
      headline: a.title,
      summary: a.summary ? a.summary.slice(0, 220) : '',
      why: '',
      importance: 3,
      source: a.source,
      published: a.published,
      link: a.link,
    }));
    return { key: category.key, label: category.label, items };
  });
}

function buildSubject({ dateLabel, spikeCount, artists, sections }) {
  const md = dateLabel.replace(/^\d+年/, '');
  if (spikeCount > 0) {
    const names = artists
      .filter((a) => a.spikes.length > 0)
      .map((a) => a.name)
      .slice(0, 2)
      .join('・');
    return `[要確認] ${md} Daily Brief — ${names} に異常値 ${spikeCount}件`;
  }
  const count = sections.reduce((a, s) => a + s.items.length, 0);
  return `${md} Daily Brief — ニュース${count}本`;
}

main().catch((err) => {
  console.error('[daily-news] 失敗しました:', err);
  process.exitCode = 1;
});
