/**
 * Spotify Web API (Client Credentials フロー)
 * 取得できる公開指標:
 *   - フォロワー数
 *   - アーティスト人気度スコア (0-100)
 *   - 日本市場のトップトラックとその人気度
 *
 * ストリーミング再生数そのものは公開APIでは取れないため、
 * 人気度スコア（直近再生の多さで変動する）をSTの代理指標として追跡する。
 */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

let cachedToken = null;

export function spotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が未設定です');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Spotify トークン取得に失敗 (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function apiGet(pathname, params = {}) {
  const token = await getToken();
  const url = new URL(`${API}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') ?? 2);
    await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
    return apiGet(pathname, params);
  }
  if (!res.ok) {
    throw new Error(`Spotify API ${pathname} が失敗 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** アーティストの当日スナップショットを取る */
export async function fetchArtistSnapshot(spotifyId, { market = 'JP' } = {}) {
  const artist = await apiGet(`/artists/${spotifyId}`);
  let topTracks = [];
  try {
    const top = await apiGet(`/artists/${spotifyId}/top-tracks`, { market });
    topTracks = (top.tracks ?? []).slice(0, 5).map((t) => ({
      id: t.id,
      name: t.name,
      popularity: t.popularity,
      album: t.album?.name ?? null,
      url: t.external_urls?.spotify ?? null,
    }));
  } catch {
    // トップトラックが取れなくてもフォロワー数だけで続行する
  }

  const trackPopularity = topTracks.length
    ? topTracks.reduce((a, t) => a + t.popularity, 0) / topTracks.length
    : null;

  return {
    name: artist.name,
    followers: artist.followers?.total ?? null,
    popularity: artist.popularity ?? null,
    trackPopularity,
    genres: artist.genres ?? [],
    url: artist.external_urls?.spotify ?? null,
    topTracks,
  };
}

/** 名前からアーティストを検索する（find-artist スクリプト用） */
export async function searchArtists(query, { limit = 5, market = 'JP' } = {}) {
  const json = await apiGet('/search', { q: query, type: 'artist', limit, market });
  return (json.artists?.items ?? []).map((a) => ({
    name: a.name,
    id: a.id,
    followers: a.followers?.total ?? null,
    popularity: a.popularity ?? null,
    genres: a.genres ?? [],
    url: a.external_urls?.spotify ?? null,
  }));
}
