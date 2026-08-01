/**
 * YouTube Data API v3
 * 取得する指標:
 *   - 公式チャンネルの登録者数 / 総再生数 / 動画本数
 *   - 直近24時間にアーティスト名を含んでアップされた動画の本数と再生数（UGCの盛り上がりの代理指標）
 *
 * クォータ: channels.list = 1 / videos.list = 1 / search.list = 100 (1日10,000)
 * UGC計測は search を使うため、アーティスト10組で1,000ユニット程度。
 */

const API = 'https://www.googleapis.com/youtube/v3';

export function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function apiGet(pathname, params = {}) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY が未設定です');

  const url = new URL(`${API}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  url.searchParams.set('key', key);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${pathname} が失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** 公式チャンネルの統計 */
export async function fetchChannelSnapshot(channelId) {
  const json = await apiGet('/channels', {
    part: 'snippet,statistics',
    id: channelId,
  });
  const item = json.items?.[0];
  if (!item) throw new Error(`YouTube チャンネルが見つかりません: ${channelId}`);

  const s = item.statistics ?? {};
  return {
    title: item.snippet?.title ?? null,
    subscribers: s.hiddenSubscriberCount ? null : num(s.subscriberCount),
    views: num(s.viewCount),
    videos: num(s.videoCount),
    url: `https://www.youtube.com/channel/${channelId}`,
  };
}

/**
 * 直近 hours 時間にアーティスト名を含んでアップされた動画を数える。
 * 公式・ファン投稿・切り抜き・カバーをまとめて拾うので、UGCの盛り上がりの代理指標になる。
 */
export async function fetchUgcSnapshot(query, { hours = 24, maxResults = 50 } = {}) {
  const publishedAfter = new Date(Date.now() - hours * 3600_000).toISOString();

  const search = await apiGet('/search', {
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    maxResults,
  });

  const ids = (search.items ?? []).map((i) => i.id?.videoId).filter(Boolean);
  if (ids.length === 0) {
    return { uploads: 0, totalViews: 0, top: [] };
  }

  const stats = await apiGet('/videos', {
    part: 'snippet,statistics',
    id: ids.join(','),
  });

  const videos = (stats.items ?? []).map((v) => ({
    id: v.id,
    title: v.snippet?.title ?? '',
    channel: v.snippet?.channelTitle ?? '',
    publishedAt: v.snippet?.publishedAt ?? null,
    views: num(v.statistics?.viewCount),
    likes: num(v.statistics?.likeCount),
    comments: num(v.statistics?.commentCount),
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  videos.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  return {
    uploads: search.pageInfo?.totalResults ?? videos.length,
    fetched: videos.length,
    totalViews: videos.reduce((a, v) => a + (v.views ?? 0), 0),
    top: videos.slice(0, 3),
  };
}

/** 名前からチャンネルを検索する（find-artist スクリプト用） */
export async function searchChannels(query, { limit = 5 } = {}) {
  const json = await apiGet('/search', {
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: limit,
  });
  return (json.items ?? []).map((i) => ({
    title: i.snippet?.title ?? '',
    channelId: i.snippet?.channelId ?? i.id?.channelId ?? null,
    description: (i.snippet?.description ?? '').slice(0, 120),
  }));
}

function num(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
