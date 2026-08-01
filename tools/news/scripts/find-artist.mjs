#!/usr/bin/env node
/**
 * アーティスト名から Spotify ID と YouTube チャンネルID を探して、
 * config/artists.json に貼り付けられる形で出力する。
 *
 *   cd tools/news
 *   npm run find-artist -- "アーティスト名"
 */
import { searchArtists, spotifyConfigured } from '../src/sources/spotify.mjs';
import { searchChannels, youtubeConfigured } from '../src/sources/youtube.mjs';

const query = process.argv.slice(2).join(' ').trim();

if (!query) {
  console.error('使い方: npm run find-artist -- "アーティスト名"');
  process.exit(1);
}

const slugify = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'artist';

console.log(`\n検索: ${query}\n`);

let spotifyId = null;
if (spotifyConfigured()) {
  try {
    const results = await searchArtists(query);
    console.log('── Spotify ──');
    if (results.length === 0) console.log('  該当なし');
    results.forEach((a, i) => {
      console.log(
        `  ${i + 1}. ${a.name}\n     id: ${a.id}\n     フォロワー ${a.followers?.toLocaleString('ja-JP') ?? '—'} / 人気度 ${a.popularity ?? '—'}${a.genres.length ? ` / ${a.genres.slice(0, 3).join(', ')}` : ''}`,
      );
    });
    spotifyId = results[0]?.id ?? null;
  } catch (err) {
    console.log(`── Spotify ──\n  取得失敗: ${err.message}`);
  }
} else {
  console.log('── Spotify ──\n  SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が未設定です');
}

console.log('');

let channelId = null;
if (youtubeConfigured()) {
  try {
    const results = await searchChannels(query);
    console.log('── YouTube ──');
    if (results.length === 0) console.log('  該当なし');
    results.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title}\n     channelId: ${c.channelId}\n     ${c.description}`);
    });
    channelId = results[0]?.channelId ?? null;
  } catch (err) {
    console.log(`── YouTube ──\n  取得失敗: ${err.message}`);
  }
} else {
  console.log('── YouTube ──\n  YOUTUBE_API_KEY が未設定です');
}

console.log(`
── config/artists.json に貼る形（1件目を採用した場合。必ず目視で確認してください）──
${JSON.stringify(
  {
    name: query,
    slug: slugify(query),
    enabled: true,
    spotifyId,
    youtubeChannelId: channelId,
    ugc: true,
    ugcQuery: null,
  },
  null,
  2,
)}
`);
