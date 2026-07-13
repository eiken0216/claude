// 比較レポート生成: 対象アーティスト × 競合数社の data.json を読み、
//   ①スケール比較（GfK最新週・共通軸） ②モメンタム（起点=100の指数化） ③比較表
//   ④対象の独自データ（SME=海外/デモグラ） ⑤お茶の間 関心比較 ⑥アドバイス
// を1枚に。GfK週次 artistTotal を全社共通の横比較軸にする（非SMEでも取れる唯一の共通指標）。
// 使い方:
//   node report_compare.mjs --self <slug> --rivals a,b,c --dir <batchDir> \
//     --names "self=表示名;a=名;b=名" --advice advice.json --title "..." --out out.html
import fs from 'fs';
import path from 'path';

const arg = (n, def) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : def; };
const dir = arg('dir');
const selfSlug = arg('self');
const rivalSlugs = (arg('rivals', '')).split(',').filter(Boolean);
const names = Object.fromEntries((arg('names', '')).split(';').filter(Boolean).map(s => s.split('=')));
const advicePath = arg('advice');
const title = arg('title', '比較レポート');
const outPath = arg('out');
const advice = advicePath && fs.existsSync(advicePath) ? JSON.parse(fs.readFileSync(advicePath, 'utf8')) : [];

const load = (slug) => { try { return JSON.parse(fs.readFileSync(path.join(dir, slug, 'data.json'), 'utf8')); } catch { return null; } };
const jp = (n) => { n = Number(n) || 0; if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 2).replace(/\.00$/, '') + '億'; if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 0 : 1).replace(/\.0$/, '') + '万'; return n.toLocaleString('ja-JP'); };
const comma = (n) => (Number(n) || 0).toLocaleString('ja-JP');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => b ? ((a - b) / b * 100) : 0;

const RCOL = ['#eb6834', '#8a6fd0', '#0ca30c', '#d98a1f', '#1fa2a2'];
const artists = [{ slug: selfSlug, self: true, col: 'var(--self)' },
  ...rivalSlugs.map((s, i) => ({ slug: s, self: false, col: RCOL[i % RCOL.length] }))]
  .map(a => ({ ...a, name: names[a.slug] || a.slug, d: load(a.slug) })).filter(a => a.d);

// 各社の共通指標を抽出（横比較軸: 最新週=現在の走行率、月次36ヶ月=3年のモメンタム）
for (const a of artists) {
  const wk = a.d.sources?.gfk?.weekly || [];
  const mo = a.d.sources?.gfk?.monthly || [];
  a.weekly = wk; a.monthly = mo;
  a.latest = wk.length ? wk[wk.length - 1].artistTotal : (mo.length ? mo[mo.length - 1].artistTotal : 0);
  a.latestMonth = mo.length ? mo[mo.length - 1].artistTotal : 0;
  const nz = mo.find(m => m.artistTotal > 0);        // 3年内デビュー勢は先頭が0
  a.first = nz ? nz.artistTotal : 0;
  a.debutMonth = (mo.length && mo[0].artistTotal === 0 && nz) ? nz.month : null;
  a.peak = mo.length ? Math.max(...mo.map(m => m.artistTotal)) : (wk.length ? Math.max(...wk.map(w => w.artistTotal)) : 0);
  a.topSong = wk.length ? wk[wk.length - 1].topSong : (mo.length ? mo[mo.length - 1].topSong : (a.d.sources?.qlono?.topSong || '—'));
  a.topSongVal = wk.length ? wk[wk.length - 1].topSongTotal : (mo.length ? mo[mo.length - 1].topSongTotal : 0);
  a.nSongs = (a.d.sources?.gfk?.catalog || []).length || (a.d.sources?.qlono?.catalog || []).length;
  const wser = (a.d.sources?.wikipedia?.jpDaily || []).map(p => p.v ?? p.views ?? 0);
  a.wikiPeak = wser.length ? Math.max(...wser) : null;
  const os = a.d.sources?.qlono?.overseasByCountry || [];
  const jpv = (os.find(o => o.country === 'JP') || {}).streams || 0;
  const tot = os.reduce((s, o) => s + o.streams, 0);
  a.overseasPct = tot ? (1 - jpv / tot) * 100 : null;
  a.overseas = os;
  a.demo = a.d.sources?.qlono?.demographics;
  const catTie = (a.d.sources?.qlono?.catalog || []).flatMap(x => x.tieups || []);
  a.tieups = catTie;
}

// ---------- スケール比較（最新週・横棒） ----------
const byLatest = artists.slice().sort((x, y) => y.latest - x.latest);
const smax = Math.max(...artists.map(a => a.latest)) || 1;
const scaleBars = byLatest.map(a => `
  <div class="bar-row"><div class="bar-lab ${a.self ? 'me' : ''}">${esc(a.name)}${a.self ? ' ★' : ''}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(a.latest / smax * 100).toFixed(1)}%;background:${a.col}"></div></div>
    <div class="bar-val">${jp(a.latest)}</div></div>`).join('');

// ---------- 規模＆成長トラック（月次・絶対値・対数軸オーバーレイ） ----------
// 3年で規模も伸びも桁違い(龍宮城は約ゼロ→数百万、既存勢は数千万で横ばい)のため、
// 指数化ではなく対数軸の絶対値で「大きさ」と「傾き＝成長」を同一図に。0月はfloorして扱う。
function momentum() {
  const W = 720, H = 250, pad = { l: 50, r: 104, t: 14, b: 26 };
  const series = artists.filter(a => a.monthly.length >= 2).map(a => ({ a, pts: a.monthly.map(m => m.artistTotal) }));
  if (!series.length) return '<div class="empty">GfK月次未取得</div>';
  const n = Math.max(...series.map(s => s.pts.length));
  const allPos = series.flatMap(s => s.pts).filter(v => v > 0);
  const maxL = Math.log10(Math.max(...allPos)), minL = Math.log10(Math.max(1, Math.min(...allPos)));
  const xs = i => pad.l + i * (W - pad.l - pad.r) / (n - 1);
  const ys = v => { const l = Math.log10(Math.max(1, v)); return H - pad.b - (l - minL) / ((maxL - minL) || 1) * (H - pad.t - pad.b); };
  const gticks = []; for (let p = Math.ceil(minL); p <= Math.floor(maxL); p++) gticks.push(Math.pow(10, p));
  const grid = gticks.map(v => `<line x1="${pad.l}" y1="${ys(v)}" x2="${W - pad.r}" y2="${ys(v)}" class="grid"/><text x="${pad.l - 6}" y="${ys(v) + 3}" class="ytick">${jp(v)}</text>`).join('');
  const lines = series.map(s => {
    const startI = Math.max(0, s.pts.findIndex(v => v > 0)); // デビュー月から線を開始（floorゼロの垂直線を避ける）
    const seg = s.pts.map((v, i) => ({ v, i })).slice(startI);
    const p = seg.map((o, k) => `${k ? 'L' : 'M'}${xs(o.i).toFixed(1)},${ys(o.v).toFixed(1)}`).join(' ');
    const lx = xs(s.pts.length - 1), ly = ys(s.pts[s.pts.length - 1]);
    return `<path d="${p}" fill="none" stroke="${s.a.col}" stroke-width="${s.a.self ? 2.8 : 1.8}" ${s.a.self ? '' : 'opacity="0.82"'}/>
      <circle cx="${lx}" cy="${ly}" r="3" fill="${s.a.col}"/>
      <text x="${lx + 6}" y="${ly + 3}" class="endlab" fill="${s.a.col}">${esc(s.a.name)}</text>`;
  }).join('');
  const mref = artists.find(a => a.monthly.length === n)?.monthly || artists[0].monthly;
  const xt = [0, Math.floor((n - 1) / 2), n - 1].map(i => `<text x="${xs(i)}" y="${H - 8}" class="xtick" text-anchor="middle">${esc(mref[i]?.month?.slice(2) || '')}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="規模と成長トラック（対数軸）">${grid}${lines}${xt}</svg>`;
}

// ---------- お茶の間 関心（ピークPV 横棒） ----------
const wmax = Math.max(1, ...artists.map(a => a.wikiPeak || 0));
const wikiBars = artists.slice().sort((x, y) => (y.wikiPeak || 0) - (x.wikiPeak || 0)).map(a => `
  <div class="bar-row"><div class="bar-lab ${a.self ? 'me' : ''}">${esc(a.name)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${((a.wikiPeak || 0) / wmax * 100).toFixed(1)}%;background:${a.col}"></div></div>
    <div class="bar-val">${a.wikiPeak == null ? '<span class="faint">未取得</span>' : comma(a.wikiPeak)}</div></div>`).join('');

// ---------- 比較表 ----------
// 3年成長: 3年内デビュー勢は「デビュー月」、10倍以上は「×N」、それ以外は「±%」。
const growthCell = a => {
  if (a.debutMonth) return `<span class="faint">デビュー${esc(a.debutMonth)}</span>`;
  if (!a.first) return '<span class="faint">—</span>';
  const r = a.latestMonth / a.first;
  if (r >= 10) return `<b class="up">×${r.toFixed(0)}</b>`;
  const p = pct(a.latestMonth, a.first);
  return `<b class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${p.toFixed(0)}%</b>`;
};
const rows = artists.map(a => `<tr class="${a.self ? 'me' : ''}">
  <td class="song"><span class="dot" style="background:${a.col}"></span>${esc(a.name)}${a.self ? ' ★' : ''}</td>
  <td class="r num">${jp(a.latest)}</td>
  <td class="r num">${jp(a.peak)}</td>
  <td class="r">${growthCell(a)}</td>
  <td>${esc(a.topSong || '—')}<span class="u2">${a.topSongVal ? ' ' + jp(a.topSongVal) + '/週' : ''}</span></td>
  <td class="r">${a.wikiPeak == null ? '<span class="faint">—</span>' : comma(a.wikiPeak)}</td>
  <td class="r">${a.overseasPct == null ? '<span class="faint">—</span>' : a.overseasPct.toFixed(1) + '%'}</td>
  <td class="tie">${a.tieups.length ? a.tieups.slice(0, 2).map(t => `<span class="chip">${esc(t.genre || '')}</span>`).join('') : (a.d.sources?.qlono ? '—' : '<span class="faint">非SME</span>')}</td>
</tr>`).join('');

// ---------- 対象の独自データ（SME=海外/デモグラ） ----------
const self = artists.find(a => a.self);
let selfPanel = '';
if (self?.overseas?.length || (Array.isArray(self?.demo) && self.demo.length)) {
  let os = '';
  if (self.overseas.length) {
    const om = Math.max(...self.overseas.map(o => o.streams));
    os = `<div class="sub-h">海外再生 国別（クロノ・累計）</div><div class="bars">${self.overseas.slice(0, 8).map(o => `
      <div class="bar-row"><div class="bar-lab">${o.country}</div><div class="bar-track"><div class="bar-fill" style="width:${(o.streams / om * 100).toFixed(1)}%;background:var(--rival)"></div></div><div class="bar-val">${jp(o.streams)}</div></div>`).join('')}</div>`;
  }
  let gender = '';
  if (Array.isArray(self.demo) && self.demo.length) {
    const gsum = {}; for (const s of self.demo) for (const g of (s.gender || [])) gsum[g.name] = (gsum[g.name] || 0) + g.ratio;
    const svc = self.demo.length; const items = [['female', '女性', 'var(--rival)'], ['male', '男性', 'var(--self)'], ['neutral', 'その他', '#8a6fd0'], ['unknown', '不明', 'var(--faint)']].filter(x => gsum[x[0]]);
    const tot = items.reduce((s, x) => s + gsum[x[0]] / svc, 0) || 1;
    gender = `<div class="sub-h" style="margin-top:14px">性別（クロノ・サービス平均）</div>
      <div class="stack">${items.map(x => `<div class="stack-seg" style="width:${(gsum[x[0]] / svc / tot * 100).toFixed(1)}%;background:${x[2]}"></div>`).join('')}</div>
      <div class="legend">${items.map(x => `<span><i style="background:${x[2]}"></i>${x[1]} ${(gsum[x[0]] / svc / tot * 100).toFixed(0)}%</span>`).join('')}</div>`;
  }
  selfPanel = `<section class="panel accent"><div class="panel-h"><h2>${esc(self.name)} の独自シグナル（SME配給＝クロノ限定）</h2><span class="src">競合は非SMEで海外/デモグラ取得不可</span></div>
    <div class="cols">${os ? `<div>${os}</div>` : ''}${gender ? `<div>${gender}</div>` : ''}</div>
    <p class="note-inline">海外再生とデモグラは対象がSME配給のため取得可。競合（非SME）は同項目を取得できないため、横比較ではなく対象の強み把握として提示。</p></section>`;
}

// ---------- アドバイス ----------
const adviceHtml = advice.length ? `<section class="panel advice"><div class="panel-h"><h2>アドバイス（データ根拠つき）</h2><span class="src">${esc(self?.name || '')}向け・要検証のたたき台</span></div>
  <ol class="adv">${advice.map(a => typeof a === 'string' ? `<li>${esc(a)}</li>` : `<li><b>${esc(a.h)}</b><div>${esc(a.body)}</div></li>`).join('')}</ol></section>` : '';

const html = `<title>${esc(title)}</title>
<style>
:root{--surface:#f7f9fb;--panel:#fff;--panel-2:#fbfcfd;--ink:#131820;--ink-soft:#3a4250;--muted:#5c6470;--faint:#8a929e;--line:#e4e8ee;--hair:#eef1f5;--self:#2a78d6;--self-soft:rgba(42,120,214,.12);--rival:#eb6834;--rival-soft:rgba(235,104,52,.12);--good:#0ca30c;--warn:#d98a1f;--crit:#d03b3b;--shadow:0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.05);--font:system-ui,-apple-system,"Segoe UI","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--surface:#0f1216;--panel:#161a20;--panel-2:#12161b;--ink:#eef1f5;--ink-soft:#cdd3db;--muted:#9aa3b0;--faint:#6b7480;--line:#262c35;--hair:#1d232b;--self:#3f8ce8;--self-soft:rgba(63,140,232,.16);--rival:#f07a45;--rival-soft:rgba(240,122,69,.16);--good:#35c635;--warn:#e6a13a;--crit:#e56767;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}}
:root[data-theme="dark"]{--surface:#0f1216;--panel:#161a20;--panel-2:#12161b;--ink:#eef1f5;--ink-soft:#cdd3db;--muted:#9aa3b0;--faint:#6b7480;--line:#262c35;--hair:#1d232b;--self:#3f8ce8;--self-soft:rgba(63,140,232,.16);--rival:#f07a45;--rival-soft:rgba(240,122,69,.16);--good:#35c635;--warn:#e6a13a;--crit:#e56767;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:28px 20px 60px}
header.top{border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px}
.eyebrow{font-size:12px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;font-weight:600}
h1{font-size:27px;margin:4px 0 8px;letter-spacing:-.01em}
.meta{color:var(--muted);font-size:13px}
.tag{display:inline-block;font-size:11px;font-weight:700;color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 40%,var(--line));border-radius:6px;padding:2px 8px;margin-left:8px;vertical-align:middle}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0;box-shadow:var(--shadow)}
.panel.accent{border-left:3px solid var(--rival)}
.panel.advice{border-left:3px solid var(--self)}
.panel-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px}
.panel-h h2{font-size:16px;margin:0}.src{font-size:11.5px;color:var(--faint);text-align:right}
.chart{width:100%;height:auto;display:block;overflow:visible}
.grid{stroke:var(--hair);stroke-width:1}.grid.base{stroke:var(--faint);stroke-dasharray:3 3;opacity:.5}
.ytick{fill:var(--faint);font-size:10px;text-anchor:end}.xtick{fill:var(--faint);font-size:10px}.endlab{font-size:10.5px;font-weight:700}
.bars{display:flex;flex-direction:column;gap:8px}
.bar-row{display:grid;grid-template-columns:118px 1fr 74px;align-items:center;gap:10px}
.bar-lab{font-size:12.5px;color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-lab.me{color:var(--ink)}
.bar-track{background:var(--hair);border-radius:5px;height:15px;overflow:hidden}.bar-fill{height:100%;border-radius:5px}
.bar-val{font-size:12px;text-align:right;color:var(--ink-soft);font-variant-numeric:tabular-nums}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.tbl th{text-align:left;color:var(--faint);font-weight:600;font-size:11px;padding:7px 7px;border-bottom:1px solid var(--line)}.tbl th.r{text-align:right}
.tbl td{padding:8px 7px;border-bottom:1px solid var(--hair);vertical-align:middle}.tbl td.r{text-align:right}
.tbl tr.me{background:var(--self-soft)}
.num{font-variant-numeric:tabular-nums;font-weight:600}.song{font-weight:600}.up{color:var(--good)}.down{color:var(--crit)}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
.u2{font-size:10.5px;color:var(--faint)}
.chip{display:inline-block;font-size:10.5px;background:var(--self-soft);color:var(--self);border-radius:5px;padding:1px 6px;margin:1px 2px 1px 0}
.faint{color:var(--faint)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:720px){.cols{grid-template-columns:1fr}.bar-row{grid-template-columns:96px 1fr 64px}}
.sub-h{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px}
.stack{display:flex;height:18px;border-radius:6px;overflow:hidden;margin-top:5px}.stack-seg{height:100%}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:12px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle}
.note-inline{font-size:11.5px;color:var(--faint);margin:10px 0 0}
.empty{color:var(--faint);font-size:13px;padding:14px;text-align:center;background:var(--panel-2);border-radius:8px}
.adv{margin:0;padding-left:20px}.adv li{margin:0 0 12px}.adv li b{color:var(--ink)}.adv li div{font-size:13.5px;color:var(--ink-soft);margin-top:2px}
.foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.lead{font-size:14px;color:var(--ink-soft);background:var(--panel-2);border:1px solid var(--hair);border-radius:10px;padding:12px 14px;margin:4px 0 0}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Competitive Analysis <span class="tag">たたき台 / 要検証</span></div>
  <h1>${esc(title)}</h1>
  <div class="meta">共通比較軸: <b>GfK 国内Streamed Unit（週次・26週）</b>／★＝対象・基準週 ${esc(self?.d?.generatedFor || '')}</div>
</header>

${self ? `<p class="lead">${esc(self.name)}の最新週 <b>${jp(self.latest)}</b> は、比較対象の最大 ${jp(byLatest[0].latest)}（${esc(byLatest[0].name)}）の約 <b>${byLatest[0].latest ? (self.latest / byLatest[0].latest * 100).toFixed(0) : '—'}%</b>。国内スケールでは ${byLatest.findIndex(a => a.self) + 1}/${artists.length} 位。以下、規模・モメンタム・関心・タイアップの各断面で差分を見る。</p>` : ''}

<section class="panel"><div class="panel-h"><h2>① 国内サブスク・スケール比較（最新週）</h2><span class="src">GfK Streamed Unit・${esc(self?.d?.generatedFor || '')}週</span></div>
  <div class="bars">${scaleBars}</div></section>

<section class="panel"><div class="panel-h"><h2>② 規模＆成長トラック（月次・対数軸・3年）</h2><span class="src">縦=月間規模(対数)・傾き=成長。大小と伸びを同一図に</span></div>
  ${momentum()}
  <p class="note-inline">縦軸は対数（万↔億）。線が高い＝規模が大きい／右上がり＝成長中。3年で桁が違うため指数化せず絶対値で表示。★＝対象を太線。GfK月次 Streamed Unit。</p></section>

<section class="panel"><div class="panel-h"><h2>③ 比較表</h2><span class="src">最新週/3年ピーク/3年成長/トップ曲/Wiki関心ピーク/海外%/タイアップ</span></div>
  <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>アーティスト</th><th class="r">最新週</th><th class="r">期間ピーク</th><th class="r">3年成長</th><th>トップ曲</th><th class="r">Wikiピーク</th><th class="r">海外%</th><th>タイアップ</th></tr></thead>
  <tbody>${rows}</tbody></table></div>
  <p class="note-inline">海外%はクロノ（SME配給）でのみ算出可。非SMEは「—」。Wikiピークは記事日次PVの期間最大＝お茶の間の瞬間関心。</p></section>

<section class="panel"><div class="panel-h"><h2>④ お茶の間・関心の瞬間最大（Wikipedia ja 日次PVピーク）</h2><span class="src">関心指標・再生数ではない</span></div>
  <div class="bars">${wikiBars}</div></section>

${selfPanel}
${adviceHtml}

<div class="foot">
  <b>データソースと限界</b>：共通軸はGfK 国内Streamed Unit（週次）。海外再生・デモグラは対象がSME配給の場合のみクロノで取得（競合＝非SMEは取得不可のため対象単独提示）。Wikipedia言語別PVは「海外の検索関心」で再生数ではない。TikTok UGCは /tiktok-report で別途。全て best-effort・数値は捏造なし・要検証のたたき台。
</div>
</div>`;

fs.writeFileSync(outPath, html);
console.log('wrote', outPath, '(', html.length, 'bytes ) artists=', artists.map(a => a.name).join(', '));
