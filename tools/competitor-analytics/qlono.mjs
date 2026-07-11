// QlonoLink / GrooveForce Analytics (https://analytics.qlonolink.com) を開く。
//
// このサービスは AWS Cognito 認証で、ログイン状態を Cookie ではなく localStorage に
// 保存する。ログインは会社の Azure AD SSO 経由のため、パスワード直接ログインは
// MFA/条件付きアクセスで弾かれやすい。そこで「ログイン済みの手元ブラウザで取り出した
// localStorage」を注入してセッションを再現する。
//
// localStorage の取り出し方（手元 Chrome で QlonoLink を開いた状態で）:
//   1. F12 → Console
//   2. copy(JSON.stringify(localStorage))
//   3. メモ帳に貼り付け → .txt 保存
//
// 使い方:
//   QLONO_LS_FILE=/path/to/localStorage.txt node qlono.mjs
//
// ※ トークンは機微情報。ファイルはリポジトリにコミットしないこと（.gitignore 済み）。
import fs from 'fs';
import { launchBrowser, newRoutedContext } from './lib/browser.mjs';

const lsFile = process.env.QLONO_LS_FILE;
if (!lsFile) {
  console.error('QLONO_LS_FILE に localStorage を書き出した .txt のパスを指定してください');
  process.exit(1);
}
const LS = JSON.parse(fs.readFileSync(lsFile, 'utf8'));

const browser = await launchBrowser();
// OAuth/SPA ルーティング維持のためリダイレクトはブラウザ側に処理させる。
const ctx = await newRoutedContext(browser, {}, { maxRedirects: 0 });
await ctx.addInitScript((ls) => {
  try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {}
}, LS);

const page = await ctx.newPage();
const target = process.argv[2] || 'https://analytics.qlonolink.com/?sk=brand&q=';
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);

const text = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ');
const onLogin = /\/login/i.test(page.url()) || /ログインまたは新規登録/.test(text);
console.log('URL:', page.url());
console.log(onLogin ? 'ログイン失敗（セッション切れ → localStorage を取り直してください）' : 'ダッシュボード表示 OK');
console.log('sample:', text.slice(0, 300));
await page.screenshot({ path: 'qlono_dashboard.png' });
console.log('screenshot: qlono_dashboard.png');

await browser.close();
process.exit(onLogin ? 2 : 0);
