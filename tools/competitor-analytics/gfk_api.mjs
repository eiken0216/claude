// GfK Planet Music 直接 API クライアント（UIを介さない）
import { request } from 'playwright';
import { UA } from './lib/browser.mjs';

const BASE = 'https://pm.gfk-e.com';
const API = 'https://pmapi.gfk-e.com/v1/products/saleskpis/w?context=jp';

export async function makeClient() {
  const rc = await request.newContext({
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    ignoreHTTPSErrors: true, userAgent: UA,
  });
  const p = await rc.get(`${BASE}/music.jp/`);
  const csrf = (await p.text()).match(/name="_csrf" value="([^"]+)"/)?.[1];
  await rc.post(`${BASE}/signin`, { form: { hash: '', _csrf: csrf, username: process.env.GFK_EMAIL, password: process.env.GFK_PASSWORD } });
  const token = (await (await rc.get(`${BASE}/music.jp/session`)).json()).token; // pmapi 認証トークン
  rc._pmToken = token;
  return rc;
}

// 指定週（monday=週の月曜 YYYY-MM-DD）のアーティスト楽曲別データ
export async function queryWeek(rc, artist, start, end = start, { cc = 'S', limit = 100 } = {}) {
  const payload = {
    ean: '', country: '1108',
    sort: [{ numberofstreams: 'DESC' }],
    region: [], channel: [], releasecategory: [],
    start, end, limit, offset: 0,
    ntos: [null], part: [], nonmusic: [0], contdist: [], format: [],
    chartcriteria: [cc],
    solrartist: { solrartist: artist, notSolrartist: '', operator: 'and' },
    solrtitle: { solrtitle: '', notSolrtitle: '', operator: 'and' },
    companies: ['-9'], genre: [], origin: [], countryoforigin: [], releasetype: 'header',
  };
  const res = await rc.post(API, {
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'origin': BASE,
      'x-mx-reqtoken': rc._pmToken,
    },
    data: payload,
    timeout: 60000,
  });
  if (!res.ok()) return { status: res.status(), rows: [], error: (await res.text()).slice(0, 200) };
  const json = await res.json();
  const obj = Array.isArray(json) ? json[0] : json;
  const rows = obj?.data?.[0]?.y || [];
  return { status: res.status(), rows, totals: obj?.totals, count: obj?.count };
}

// 直接実行時の動作確認
if (import.meta.url === `file://${process.argv[1]}`) {
  const rc = await makeClient();
  const artist = process.argv[2] || '龍宮城';

  console.log(`\n[1] 最新週 (2026-06-29) の ${artist} 楽曲別 再生数（Single）`);
  const wk = await queryWeek(rc, artist, '2026-06-29');
  console.log('status:', wk.status, 'count:', wk.count, 'rows:', wk.rows.length);
  for (const r of wk.rows.slice(0, 10)) {
    console.log(`  ${r.rank}. ${r.title} | streams=${r.numberofstreams} stream_units=${r.total_stream_units} prem=${r.stream_premium_units} free=${r.stream_free_units} | ${r.mediatype} ${r.release}`);
  }

  console.log(`\n[2] 期間指定の挙動確認: 2026-06-01〜2026-06-29 を1クエリ`);
  const rng = await queryWeek(rc, artist, '2026-06-01', '2026-06-29');
  console.log('status:', rng.status, 'rows:', rng.rows.length);
  for (const r of rng.rows.slice(0, 5)) {
    console.log(`  ${r.title} | streams=${r.numberofstreams} (range集計か週次か判定用)`);
  }

  await rc.dispose();
}
