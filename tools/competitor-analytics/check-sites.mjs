// 競合アーティスト分析に使う各データソースへの疎通・データ取得チェック。
// 使い方: node check-sites.mjs
import { launchBrowser, newRoutedContext } from './lib/browser.mjs';

const snip = (t, n = 240) => (t || '').replace(/\s+/g, ' ').slice(0, n);

const targets = [
  { name: 'GfK Planet Music（要ログイン → gfk.mjs 参照）', url: 'https://pm.gfk-e.com/music.jp/',
    probe: async (page, text) => `signinForm=${/Sign in with your Planet Music/.test(text)}` },
  { name: 'Spotify Charts 公式（チャート本体は Spotify ログイン必須）', url: 'https://charts.spotify.com/charts/view/regional-jp-weekly/latest',
    probe: async (page, text) => `loginRequired=${/Log in/i.test(text)}` },
  { name: 'kworb.net（Spotify チャートのミラー・ログイン不要）', url: 'https://kworb.net/spotify/country/jp_weekly.html',
    probe: async (page, text) => `rows=${await page.locator('table tr').count()}` },
  { name: 'YouTube Charts JP 週間', url: 'https://charts.youtube.com/charts/TopSongs/jp/weekly',
    probe: async (page) => `entryRows=${await page.locator('ytmc-entry-row').count()}` },
  { name: 'Melon Chart', url: 'https://www.melon.com/chart/index.htm',
    probe: async (page) => `title=${await page.title()}` },
  { name: 'Wikipedia PV API（pageviews ツールの裏 API）',
    url: 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/user/Creepy_Nuts/daily/2026060100/2026061000',
    probe: async (page, text) => `json=${text.includes('"views"')}` },
  { name: 'Google トレンド（DC IP のため 429 になりがち）', url: 'https://trends.google.co.jp/trends/explore?geo=JP&q=Creepy%20Nuts',
    probe: async (page, text) => `rateLimited=${/429|too many requests/i.test(text)}` },
  { name: 'NAVER DataLab', url: 'https://datalab.naver.com/keyword/trendSearch.naver',
    probe: async (page) => `formInputs=${await page.locator('input').count()}` },
  { name: 'JOYSOUND 楽曲ページ', url: 'https://www.joysound.com/web/search/song/1143475',
    probe: async (page) => `title=${await page.title()}` },
  { name: 'GFA / GrooveForce（要ログイン・認証情報未入手）', url: 'https://analytics.grooveforce.jp/brand/creepynuts/reports',
    probe: async (page) => `finalURL=${page.url()}` },
  { name: 'QlonoLink（要ログイン・認証情報未入手）', url: 'https://analytics.qlonolink.com/?sk=brand&q=',
    probe: async (page) => `finalURL=${page.url()}` },
  { name: 'TikTok 楽曲ページ（bot 対策強め・要調査）', url: 'https://www.tiktok.com/music/Top-50-7307127948090313474',
    probe: async (page, text) => `notFound=${text.includes('この楽曲は見つかりませんでした')}` },
];

const browser = await launchBrowser();
const ctx = await newRoutedContext(browser);

for (const t of targets) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(7000);
    const text = (await page.textContent('body').catch(() => '')) || '';
    console.log(`\n### ${t.name}\nHTTP ${resp?.status()} | ${await t.probe(page, text)}\n  ${snip(text, 160)}`);
  } catch (e) {
    console.log(`\n### ${t.name}\nERROR: ${e.message.split('\n')[0].slice(0, 100)}`);
  } finally {
    await page.close();
  }
}
await browser.close();
