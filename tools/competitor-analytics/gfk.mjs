// GfK Planet Music (https://pm.gfk-e.com/music.jp/) にログインして Rankings 画面を開く。
//
// 認証情報は環境変数で渡す（リポジトリにはコミットしない）:
//   GFK_EMAIL=SMM.GFKxx@sonymusic.co.jp GFK_PASSWORD=... node gfk.mjs
//
// ログインは /signin への form POST（hash, _csrf, username, password）。
// セッション Cookie を取得したあと、ブラウザに引き継いで SPA を表示する。
import { request } from 'playwright';
import { launchBrowser, newRoutedContext, UA } from './lib/browser.mjs';

const BASE = 'https://pm.gfk-e.com';
const APP = `${BASE}/music.jp/`;

async function login(email, password) {
  const rc = await request.newContext({
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    ignoreHTTPSErrors: true,
    userAgent: UA,
  });
  const signinPage = await rc.get(APP); // → /signin にリダイレクト
  const html = await signinPage.text();
  const csrf = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error('CSRF token not found — 既にログイン済みかページ構造が変わった可能性');
  const post = await rc.post(`${BASE}/signin`, {
    form: { hash: '', _csrf: csrf, username: email, password },
  });
  const after = await post.text();
  if (/Sign in with your Planet Music/.test(after)) {
    throw new Error('ログイン失敗（ID/PW を確認してください）');
  }
  const { cookies } = await rc.storageState();
  await rc.dispose();
  return cookies;
}

async function main() {
  const email = process.env.GFK_EMAIL;
  const password = process.env.GFK_PASSWORD;
  if (!email || !password) {
    console.error('GFK_EMAIL / GFK_PASSWORD を環境変数で指定してください');
    process.exit(1);
  }

  console.log('ログイン中...');
  const cookies = await login(email, password);
  console.log(`セッション取得 OK（cookie ${cookies.length} 件）`);

  const browser = await launchBrowser();
  const ctx = await newRoutedContext(browser);
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${APP}#/ranking`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  const body = (await page.textContent('body')) || '';
  const ok = /Rankings/i.test(body) && !/Sign in with your Planet Music/.test(body);
  console.log(ok ? 'Rankings 画面の表示に成功' : '表示失敗（ログイン画面のまま）');
  await page.screenshot({ path: 'gfk_rankings.png' });
  console.log('スクリーンショット: gfk_rankings.png');

  await browser.close();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
