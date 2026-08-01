import { XMLParser } from 'fast-xml-parser';

/**
 * RSS 2.0 / Atom フィードを取得してフラットな記事配列にする。
 * 1つのフィードが落ちていても全体を止めない。
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

// 多くのニュースサイトは bot 風の User-Agent を 402/403 で弾くため、
// ブラウザと同じ UA を送る。
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchFeed(url, { timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return textOf(v['#text'] ?? '');
  return '';
}

const NAMED_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  middot: '·',
  bull: '•',
};

/** 数値参照 (&#8216; / &#x2018;) と主要な名前付き実体をデコードする */
function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function stripHtml(html) {
  // タグを剥がしてから実体参照を戻す（実体で表現されたタグを二重に消さないため）
  const withoutTags = textOf(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function parseDate(value) {
  const text = textOf(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function normalizeRssItem(item) {
  return {
    title: stripHtml(item.title),
    link: textOf(item.link) || textOf(item.guid),
    published: parseDate(item.pubDate ?? item['dc:date'] ?? item.published),
    summary: stripHtml(item.description ?? item['content:encoded'] ?? ''),
  };
}

function normalizeAtomEntry(entry) {
  const links = asArray(entry.link);
  const alternate =
    links.find((l) => l['@_rel'] === 'alternate' || l['@_rel'] === undefined) ?? links[0];
  return {
    title: stripHtml(entry.title),
    link: alternate?.['@_href'] ?? textOf(entry.id),
    published: parseDate(entry.published ?? entry.updated),
    summary: stripHtml(entry.summary ?? entry.content ?? ''),
  };
}

/**
 * 1つのフィードを取得して記事配列を返す。
 * @returns {Promise<{ok: true, items: Array}|{ok: false, error: string}>}
 */
export async function loadFeed(feed) {
  try {
    const xml = await fetchFeed(feed.url);
    const doc = parser.parse(xml);

    let items = [];
    if (doc?.rss?.channel) {
      items = asArray(doc.rss.channel.item).map(normalizeRssItem);
    } else if (doc?.feed) {
      items = asArray(doc.feed.entry).map(normalizeAtomEntry);
    } else if (doc?.['rdf:RDF']) {
      // RSS 1.0 (RDF)
      items = asArray(doc['rdf:RDF'].item).map(normalizeRssItem);
    } else {
      throw new Error('RSS/Atom として解釈できませんでした');
    }

    return {
      ok: true,
      items: items.filter((i) => i.title && i.link),
    };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'タイムアウト' : err.message };
  }
}

/**
 * Google ニュースの検索結果を RSS として取り出す URL を作る。
 * API キーが要らないので、日本語ソースの補完とアーティスト言及数の計測に使う。
 */
export function googleNewsUrl(query, { days = 1, lang = 'ja', country = 'JP' } = {}) {
  const q = `${query} when:${days}d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
}

/**
 * Google ニュースの見出しは「本当の見出し - 媒体名」形式で、
 * description は見出しの繰り返しになっている。媒体名を切り出して整える。
 */
function normalizeGoogleNewsItem(item) {
  const sep = item.title.lastIndexOf(' - ');
  const outlet = sep > 0 ? item.title.slice(sep + 3).trim() : '';
  const title = sep > 0 ? item.title.slice(0, sep).trim() : item.title;

  // description が見出しの焼き直しなら捨てる（プロンプトの水増しを防ぐ）
  const summary = item.summary && !item.summary.startsWith(title) ? item.summary : '';

  return { ...item, title, outlet, summary };
}

/**
 * あるキーワードについて、直近 hours 時間の報道を取得する。
 * @returns {Promise<{ok: true, items: Array}|{ok: false, error: string}>}
 */
export async function fetchNewsMentions(query, { hours = 24, lang = 'ja', country = 'JP' } = {}) {
  const days = Math.max(1, Math.ceil(hours / 24));
  const result = await loadFeed({ url: googleNewsUrl(query, { days, lang, country }) });
  if (!result.ok) return result;

  const cutoff = Date.now() - hours * 3600_000;
  const seen = new Set();
  const items = result.items
    .filter((i) => !i.published || i.published.getTime() >= cutoff)
    .map(normalizeGoogleNewsItem)
    // 転載（Yahoo!ニュース等）で同じ見出しが並ぶので、言及数を水増ししないよう畳む
    .filter((i) => {
      const key = dedupeKey(i);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0));

  return { ok: true, items };
}

/**
 * カテゴリ定義に沿って全フィードを取得し、期間で絞り、重複を除く。
 */
export async function collectArticles(config, { lookbackHours }) {
  const cutoff = Date.now() - lookbackHours * 3600_000;
  const categories = [];
  const failures = [];

  for (const category of config.categories) {
    const enabled = category.feeds.filter((f) => f.enabled !== false);
    const days = Math.max(1, Math.ceil(lookbackHours / 24));
    const results = await Promise.all(
      enabled.map((f) => {
        // google: 検索クエリ を書いた項目は Google ニュース RSS として組み立てる
        const url = f.google ? googleNewsUrl(f.google, { days }) : f.url;
        return loadFeed({ ...f, url }).then((r) => [f, r]);
      }),
    );

    const seen = new Set();
    const articles = [];

    for (const [feed, result] of results) {
      if (!result.ok) {
        failures.push({ category: category.label, feed: feed.name, error: result.error });
        continue;
      }
      const recent = result.items
        .map((i) => (feed.google ? normalizeGoogleNewsItem(i) : i))
        .filter((i) => !i.published || i.published.getTime() >= cutoff)
        .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0))
        .slice(0, config.maxPerFeed ?? 12);

      for (const item of recent) {
        const key = dedupeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        // Google ニュース経由なら、検索名ではなく実際の媒体名を出典として見せる
        articles.push({
          ...item,
          source: item.outlet || feed.name,
          category: category.key,
        });
      }
    }

    articles.sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0));
    categories.push({ ...category, articles });
  }

  return { categories, failures };
}

// 同じ記事が直接RSSとGoogleニュースの両方から入ることがあるため、
// リンクではなく正規化した見出しで重複を判定する。
function dedupeKey(item) {
  return item.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 80);
}
