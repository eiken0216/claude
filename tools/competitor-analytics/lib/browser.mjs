// 共通ヘルパー: この実行環境（Claude Code リモート環境）でブラウザを動かすための設定。
//
// 環境の egress プロキシは Chromium の TLS ClientHello を扱えず接続がリセットされる
// (net::ERR_CONNECTION_RESET)。そのためページの通信をすべて Playwright の
// Node 側ネットワークスタック (route.fetch) に迂回させる。curl 相当の経路なので通る。
import { chromium } from 'playwright';

export const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export async function launchBrowser() {
  const opts = { args: ['--no-sandbox'] };
  if (process.env.HTTPS_PROXY) {
    opts.executablePath = CHROME_PATH;
    opts.proxy = { server: process.env.HTTPS_PROXY };
  }
  return chromium.launch(opts);
}

export async function newRoutedContext(browser, contextOptions = {}) {
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: 'ja-JP',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    ...contextOptions,
  });
  await ctx.route('**/*', async (route) => {
    try {
      const resp = await route.fetch({ maxRedirects: 8 });
      await route.fulfill({ response: resp });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  return ctx;
}
