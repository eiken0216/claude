// 個別アーティスト・レポート生成: data.json → 統一テンプレの1枚HTML。
// 18本を同一様式で出し、横比較（＝比較レポート）に直結させる。
// 使い方: node report_individual.mjs <data.json> <out.html> ["表示名"]
import fs from 'fs';

const inPath = process.argv[2], outPath = process.argv[3];
const d = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const displayName = process.argv[4] || d.artist;

// ---------- 数値整形（日本語ユニット） ----------
const jp = (n) => {
  n = Number(n) || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 2).replace(/\.00$/, '') + '億';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 0 : n >= 1e5 ? 1 : 1).replace(/\.0$/, '') + '万';
  return n.toLocaleString('ja-JP');
};
const comma = (n) => (Number(n) || 0).toLocaleString('ja-JP');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => b ? ((a - b) / b * 100) : 0;

// ---------- ソース判定 ----------
const av = d.availability || {};
const gfk = d.sources?.gfk;
const qlono = d.sources?.qlono;
const charts = d.sources?.charts;
const wiki = d.sources?.wikipedia;
const primary = d.primaryStreamingSource || 'none';

// ---------- 折れ線（インラインSVG） ----------
function lineChart(series, { w = 720, h = 190, color = 'var(--self)', fill = 'var(--self-soft)', label = '' } = {}) {
  const pts = series.filter(p => p && isFinite(p.v));
  if (pts.length < 2) return `<div class="empty">系列データ不足（未取得）</div>`;
  const pad = { l: 52, r: 14, t: 14, b: 26 };
  const xs = (i) => pad.l + i * (w - pad.l - pad.r) / (pts.length - 1);
  const maxV = Math.max(...pts.map(p => p.v)), minV = Math.min(0, ...pts.map(p => p.v));
  const ys = (v) => h - pad.b - (v - minV) / ((maxV - minV) || 1) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
  const area = `M${xs(0).toFixed(1)},${ys(minV).toFixed(1)} ` + pts.map((p, i) => `L${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ') + ` L${xs(pts.length - 1).toFixed(1)},${ys(minV).toFixed(1)} Z`;
  const gy = [maxV, maxV * 0.5, 0].map(v => `<line x1="${pad.l}" y1="${ys(v)}" x2="${w - pad.r}" y2="${ys(v)}" class="grid"/><text x="${pad.l - 8}" y="${ys(v) + 3}" class="ytick">${jp(v)}</text>`).join('');
  const ticks = [0, Math.floor(pts.length / 2), pts.length - 1].map(i => `<text x="${xs(i)}" y="${h - 8}" class="xtick" text-anchor="middle">${esc(pts[i].x || '')}</text>`).join('');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(label)}">
    ${gy}<path d="${area}" fill="${fill}" stroke="none"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.2"/>
    <circle cx="${xs(pts.length - 1)}" cy="${ys(last.v)}" r="3.4" fill="${color}"/>
    <text x="${xs(pts.length - 1) - 4}" y="${ys(last.v) - 8}" class="pointlab" text-anchor="end">${jp(last.v)}</text>
    ${ticks}</svg>`;
}

// ---------- 横棒（海外国別 等） ----------
function barChart(rows, { max, color = 'var(--self)', unit = '' } = {}) {
  if (!rows.length) return `<div class="empty">未取得</div>`;
  const m = max || Math.max(...rows.map(r => r.v));
  return `<div class="bars">` + rows.map(r => `
    <div class="bar-row"><div class="bar-lab">${esc(r.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.v / m * 100).toFixed(1)}%;background:${color}"></div></div>
      <div class="bar-val">${jp(r.v)}${unit}</div></div>`).join('') + `</div>`;
}

// ---------- スパークライン（曲別・小さな折れ線） ----------
const relFmt = r => { if (!r) return '配信日—'; const s = String(r); return s.includes('-') ? s.slice(0, 10) : s.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'); };
function sparkline(pts, color) {
  pts = pts.filter(p => isFinite(p.v));
  if (pts.length < 2) return `<div class="empty" style="padding:8px">データ不足</div>`;
  const w = 320, h = 70, pad = { l: 4, r: 4, t: 9, b: 4 };
  const xs = i => pad.l + i * (w - pad.l - pad.r) / (pts.length - 1);
  const mx = Math.max(...pts.map(p => p.v)) || 1;
  const ys = v => h - pad.b - (v / mx) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
  const area = `M${xs(0).toFixed(1)},${h - pad.b} ` + pts.map((p, i) => `L${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ') + ` L${xs(pts.length - 1).toFixed(1)},${h - pad.b} Z`;
  const pk = pts.reduce((a, p, i) => p.v > pts[a].v ? i : a, 0);
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img"><path d="${area}" fill="${color}" opacity="0.13"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6"/><circle cx="${xs(pk).toFixed(1)}" cy="${ys(pts[pk].v).toFixed(1)}" r="2.6" fill="${color}"/></svg>`;
}
function songMultiples(songs, mode) { // mode: 'daily' | 'monthly'
  const SC = ['var(--self)', 'var(--rival)', '#8a6fd0', 'var(--good)', 'var(--warn)'];
  return `<div class="mults">` + songs.map((s, i) => {
    const pts = (s.series || []).map(p => mode === 'daily' ? { x: p.date, v: p.v } : { x: p.month, v: p.total });
    const peak = Math.max(0, ...pts.map(p => p.v));
    const first = pts.length ? pts[0].x : '';
    const tie = (s.tieups || [])[0];
    const total = s.total != null ? s.total : pts.reduce((a, p) => a + p.v, 0);
    return `<div class="mult"><div class="mult-h"><span class="mult-t">${i + 1}. ${esc(s.title)}</span>${tie ? `<span class="chip">${esc(tie.genre || '')}</span>` : ''}</div>
      <div class="mult-m">${esc(relFmt(s.released))} ・ ${mode === 'daily' ? '累計' : '36ヶ月計'} ${jp(total)}</div>
      ${sparkline(pts, SC[i % SC.length])}
      <div class="mult-f"><span>ピーク ${jp(peak)}/${mode === 'daily' ? '日' : '月'}</span><span>${mode === 'daily' ? 'デイリー' : '月次'}・${esc(first)}〜</span></div></div>`;
  }).join('') + `</div>`;
}
let top5Panel = '';
if (qlono?.topSongsDaily?.length) {
  top5Panel = `<section class="panel"><div class="panel-h"><h2>人気曲5曲・デイリー推移（リリース〜現在）</h2><span class="src">クロノ world_sales 日次・全期間</span></div>
    ${songMultiples(qlono.topSongsDaily, 'daily')}</section>`;
} else if (gfk?.topSongsMonthly?.length) {
  const relMap = Object.fromEntries((gfk.catalog || []).map(c => [c.title, c.release]));
  const songs = gfk.topSongsMonthly.map(s => ({ ...s, released: relMap[s.title] }));
  top5Panel = `<section class="panel"><div class="panel-h"><h2>人気曲5曲・月次推移（直近3年）</h2><span class="src">GfK 月次・曲別デイリーは非SME不可</span></div>
    ${songMultiples(songs, 'monthly')}
    <p class="note-inline">非SME配給のため曲別デイリーは取得不可。GfK月次で直近3年の推移を表示（デイリー相当はSME配給曲のみ）。GfKは曲名単位の集計（同名別バージョンを含む場合あり）。</p></section>`;
}

// ---------- KPI群 ----------
// 横比較の共通軸として、GfK週次 artistTotal を常に先頭に（18本中ほとんどが非SME=GfKのみのため）。
// SME配給ならクロノの per-song 28日・海外比率を「濃い補足」として追加。
const kpis = [];
if (gfk?.weekly?.length) {
  const wk = gfk.weekly, last = wk[wk.length - 1], prev = wk[wk.length - 2];
  kpis.push({ k: '国内サブスク（最新週・GfK）', v: jp(last.artistTotal), sub: `Streamed Unit ・${last.week}週`, d: prev ? pct(last.artistTotal, prev.artistTotal) : null });
  kpis.push({ k: 'トップ曲（最新週・GfK）', v: esc(last.topSong || '—'), sub: last.topSongTotal ? jp(last.topSongTotal) + '/週' : '', d: null, small: true });
}
if (qlono?.catalog?.length) {
  const top = qlono.catalog[0];
  kpis.push({ k: 'クロノ・トップ曲（28日）', v: jp(top.total28d), sub: `SME内部 ・${esc(top.title)}`, d: null });
}
if (qlono?.overseasByCountry?.length) {
  const os = qlono.overseasByCountry;
  const nonJp = os.filter(o => o.country !== 'JP').reduce((s, o) => s + o.streams, 0);
  const jpv = (os.find(o => o.country === 'JP') || {}).streams || 0;
  kpis.push({ k: '海外再生比率（累計）', v: (jpv + nonJp) ? (nonJp / (jpv + nonJp) * 100).toFixed(1) + '%' : '—', sub: `クロノ world_sales ・海外 ${jp(nonJp)}`, d: null });
}
const itHit = (charts?.itunesJP || [])[0];
if (itHit) kpis.push({ k: 'iTunes JP 最高位', v: '#' + itHit.rank, sub: esc(itHit.name || ''), d: null, small: true });

// ---------- サブスク推移（GfK月次・直近3年を共通軸に） ----------
let trendPanel = '';
if (gfk?.monthly?.length >= 2) {
  const mo = gfk.monthly, series = mo.map(m => ({ x: m.month.slice(2), v: m.artistTotal }));
  const last = mo[mo.length - 1].artistTotal, first = mo[0].artistTotal;
  const peak = Math.max(...mo.map(m => m.artistTotal)), peakMo = mo.find(m => m.artistTotal === peak);
  trendPanel = `<section class="panel">
    <div class="panel-h"><h2>国内サブスク推移（直近3年）</h2><span class="src">GfK Streamed Unit・月次・${mo.length}ヶ月</span></div>
    ${lineChart(series, { label: '国内サブスク月次推移3年' })}
    <div class="mini-row">
      <div class="mini"><span>ピーク月（${esc(peakMo?.month || '')}）</span><b>${jp(peak)}</b></div>
      <div class="mini"><span>3年前比</span><b class="${last >= first ? 'up' : 'down'}">${first ? (pct(last, first) >= 0 ? '+' : '') + pct(last, first).toFixed(0) + '%' : '—'}</b></div>
      <div class="mini"><span>直近月（${esc(mo[mo.length - 1].month)}）</span><b>${jp(last)}</b></div>
    </div></section>`;
} else if (qlono?.topSeries?.length >= 2) {
  const series = qlono.topSeries.map(p => ({ x: (p.date || '').slice(5), v: p.v }));
  trendPanel = `<section class="panel">
    <div class="panel-h"><h2>サブスク推移（トップ曲・日次）</h2><span class="src">クロノ・${esc(qlono.topSong || '')}・28日</span></div>
    ${lineChart(series, { label: 'トップ曲日次推移' })}
    <p class="note-inline">アーティスト合計の週次はGfK未取得。トップ曲の日次のみ（クロノ）。</p></section>`;
} else {
  trendPanel = `<section class="panel"><div class="panel-h"><h2>国内サブスク推移</h2><span class="src">未取得</span></div>
    <div class="empty">国内サブスク時系列は未取得（${esc(av.gfk || '')} / ${esc(av.qlono || '')}）。</div></section>`;
}

// ---------- 海外再生（クロノのみ） ----------
let overseasPanel = '';
if (qlono?.overseasByCountry?.length) {
  const os = qlono.overseasByCountry.slice(0, 12);
  const rows = os.map(o => ({ label: o.country, v: o.streams }));
  overseasPanel = `<section class="panel">
    <div class="panel-h"><h2>海外再生（国別・累計）</h2><span class="src">クロノ world_sales</span></div>
    ${barChart(rows, { color: 'var(--rival)' })}</section>`;
} else {
  overseasPanel = `<section class="panel">
    <div class="panel-h"><h2>海外再生（国別）</h2><span class="src">クロノのみ</span></div>
    <div class="empty">海外再生はクロノ（SME配給曲）でしか取得できず、本アーティストは未取得。<br>参考: Wikipedia言語別PV＝「海外の検索関心」であって再生数ではない。</div></section>`;
}

// ---------- カタログ上位曲＋タイアップ ----------
let catalogPanel = '';
const cat = qlono?.catalog?.length ? qlono.catalog.map(x => ({ title: x.title, v: x.total28d, unit: '/28日', rel: x.released, tie: x.tieups || [] }))
  : (gfk?.catalog || []).map(x => ({ title: x.title, v: x.total, unit: '/週', rel: x.release, tie: [] }));
if (cat.length) {
  const src = qlono?.catalog?.length ? 'クロノ（28日・タイアップ付）' : 'GfK（最新週）';
  catalogPanel = `<section class="panel">
    <div class="panel-h"><h2>カタログ上位曲</h2><span class="src">${src}</span></div>
    <table class="tbl"><thead><tr><th>曲</th><th class="r">再生</th><th>配信日</th><th>タイアップ</th></tr></thead><tbody>
    ${cat.slice(0, 10).map(r => `<tr><td class="song">${esc(r.title)}</td><td class="r num">${jp(r.v)}<span class="u">${r.unit}</span></td>
      <td class="dt">${r.rel ? esc(String(r.rel).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3').slice(0, 10)) : '—'}</td>
      <td class="tie">${(r.tie || []).length ? r.tie.map(t => `<span class="chip">${esc(t.genre || '')}${t.title ? '：' + esc(t.title) : ''}</span>`).join('') : (qlono?.catalog?.length ? '—' : '<span class="faint">要手動（非SME）</span>')}</td></tr>`).join('')}
    </tbody></table></section>`;
}

// ---------- お茶の間（Wikipedia ja 日次） ----------
let wikiPanel = '';
if (wiki?.jpDaily?.length >= 2) {
  const series = wiki.jpDaily.map(p => ({ x: String(p.date || '').slice(5).replace('-', '/'), v: p.views ?? p.v }));
  const peak = Math.max(...series.map(s => s.v));
  wikiPanel = `<section class="panel">
    <div class="panel-h"><h2>お茶の間（Wikipedia ja 日次PV）</h2><span class="src">関心指標・${series.length}日</span></div>
    ${lineChart(series, { color: 'var(--warn)', fill: 'rgba(217,138,31,.12)', label: 'Wikipedia日次PV' })}
    <div class="mini-row"><div class="mini"><span>ピークPV/日</span><b>${comma(peak)}</b></div></div></section>`;
} else {
  wikiPanel = `<section class="panel"><div class="panel-h"><h2>お茶の間（Wikipedia ja）</h2><span class="src">補助指標</span></div>
    <div class="empty">日次PV未取得（記事名の当て込み要調整 / ${esc(av.wikipedia || '')}）。</div></section>`;
}

// ---------- デモグラ（クロノ・あれば：サービス横断の性別平均＋年代分布） ----------
let demoPanel = '';
const demo = qlono?.demographics;
if (Array.isArray(demo) && demo.length && demo.some(s => s.gender || s.age_range)) {
  const svcs = demo.filter(s => s.gender || s.age_range);
  const gsum = {};
  for (const s of svcs) for (const g of (s.gender || [])) gsum[g.name] = (gsum[g.name] || 0) + g.ratio;
  const gorder = ['female', 'male', 'neutral', 'unknown'];
  const gcol = { female: 'var(--rival)', male: 'var(--self)', neutral: '#8a6fd0', unknown: 'var(--faint)' };
  const glabel = { female: '女性', male: '男性', neutral: 'その他', unknown: '不明' };
  const gitems = Object.keys(gsum).map(n => ({ name: n, r: gsum[n] / svcs.length })).sort((a, b) => (gorder.indexOf(a.name) + 9) % 9 - (gorder.indexOf(b.name) + 9) % 9);
  const gtot = gitems.reduce((s, x) => s + x.r, 0) || 1;
  const genderBar = `<div class="stack">${gitems.map(g => `<div class="stack-seg" style="width:${(g.r / gtot * 100).toFixed(1)}%;background:${gcol[g.name] || 'var(--faint)'}" title="${glabel[g.name] || g.name}"></div>`).join('')}</div>
    <div class="legend">${gitems.map(g => `<span><i style="background:${gcol[g.name] || 'var(--faint)'}"></i>${glabel[g.name] || esc(g.name)} ${(g.r / gtot * 100).toFixed(0)}%</span>`).join('')}</div>`;
  const asvc = svcs.find(s => /APPLE/i.test(s.service_id || '')) || svcs.find(s => s.age_range) || svcs[0];
  const ages = (asvc.age_range || []).filter(a => a.range !== 'Data Unknown');
  const amax = Math.max(0.0001, ...ages.map(a => a.ratio));
  const ageBars = `<div class="bars age">${ages.map(a => `<div class="bar-row"><div class="bar-lab">${esc(a.range)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(a.ratio / amax * 100).toFixed(1)}%;background:var(--self)"></div></div>
    <div class="bar-val">${(a.ratio * 100).toFixed(0)}%</div></div>`).join('')}</div>`;
  demoPanel = `<section class="panel"><div class="panel-h"><h2>デモグラ（クロノ）</h2><span class="src">${svcs.length}サービス横断・性別平均／年代=${esc(asvc.service_id || '')}</span></div>
    <div class="cols"><div><div class="sub-h">性別（サービス平均）</div>${genderBar}</div>
    <div><div class="sub-h">年代分布（${esc(asvc.service_id || '')}）</div>${ageBars}</div></div></section>`;
}

// ---------- 未取得ソース ----------
const skipped = Object.entries(av).filter(([k, v]) => /skipped|not-found|manual|error|no-data/.test(String(v)) && !['googleTrends', 'naverDataLab', 'joysound', 'igxFollowers', 'tiktokUGC'].includes(k));
const manualList = ['googleTrends', 'naverDataLab', 'joysound', 'igxFollowers'].map(k => av[k]).filter(Boolean);

// ---------- ソースバッジ ----------
const badge = (ok, name) => `<span class="bdg ${ok ? 'on' : 'off'}">${ok ? '●' : '○'} ${name}</span>`;
const badges = [
  badge(av.gfk === 'ok', 'GfK'),
  badge(av.qlono === 'ok', 'クロノ'),
  badge(av.charts === 'ok', 'iTunes'),
  badge(av.wikipedia === 'ok', 'Wikipedia'),
].join('');

const html = `<title>アーティスト分析 — ${esc(displayName)}</title>
<style>
:root{--surface:#f7f9fb;--panel:#fff;--panel-2:#fbfcfd;--ink:#131820;--ink-soft:#3a4250;--muted:#5c6470;--faint:#8a929e;--line:#e4e8ee;--hair:#eef1f5;--self:#2a78d6;--self-soft:rgba(42,120,214,.12);--rival:#eb6834;--rival-soft:rgba(235,104,52,.12);--good:#0ca30c;--warn:#d98a1f;--crit:#d03b3b;--shadow:0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.05);--font:system-ui,-apple-system,"Segoe UI","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--surface:#0f1216;--panel:#161a20;--panel-2:#12161b;--ink:#eef1f5;--ink-soft:#cdd3db;--muted:#9aa3b0;--faint:#6b7480;--line:#262c35;--hair:#1d232b;--self:#3f8ce8;--self-soft:rgba(63,140,232,.16);--rival:#f07a45;--rival-soft:rgba(240,122,69,.16);--good:#35c635;--warn:#e6a13a;--crit:#e56767;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}}
:root[data-theme="dark"]{--surface:#0f1216;--panel:#161a20;--panel-2:#12161b;--ink:#eef1f5;--ink-soft:#cdd3db;--muted:#9aa3b0;--faint:#6b7480;--line:#262c35;--hair:#1d232b;--self:#3f8ce8;--self-soft:rgba(63,140,232,.16);--rival:#f07a45;--rival-soft:rgba(240,122,69,.16);--good:#35c635;--warn:#e6a13a;--crit:#e56767;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:28px 20px 60px}
header.top{border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px}
.eyebrow{font-size:12px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;font-weight:600}
h1{font-size:30px;margin:4px 0 8px;letter-spacing:-.01em}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.bdg{font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.bdg.on{color:var(--good);border-color:color-mix(in srgb,var(--good) 40%,var(--line))}
.bdg.off{color:var(--faint)}
.meta{color:var(--muted);font-size:13px;margin-top:6px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:20px 0}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
.kpi .k{font-size:12px;color:var(--muted);font-weight:600}
.kpi .v{font-size:25px;font-weight:700;margin:3px 0 1px;letter-spacing:-.01em}
.kpi .v.sm{font-size:18px}
.kpi .s{font-size:11.5px;color:var(--faint)}
.kpi .delta{font-size:12px;font-weight:700}.delta.up{color:var(--good)}.delta.down{color:var(--crit)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;margin:16px 0;box-shadow:var(--shadow)}
.panel-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px}
.panel-h h2{font-size:16px;margin:0}
.src{font-size:11.5px;color:var(--faint);text-align:right}
.chart{width:100%;height:auto;display:block;overflow:visible}
.grid{stroke:var(--hair);stroke-width:1}.ytick{fill:var(--faint);font-size:10px;text-anchor:end}.xtick{fill:var(--faint);font-size:10px}
.pointlab{fill:var(--ink-soft);font-size:11px;font-weight:700}
.mini-row{display:flex;gap:22px;margin-top:10px;flex-wrap:wrap}
.mini{font-size:12px;color:var(--muted)}.mini b{display:block;font-size:16px;color:var(--ink)}
.mini b.up{color:var(--good)}.mini b.down{color:var(--crit)}
.bars{display:flex;flex-direction:column;gap:7px}
.bar-row{display:grid;grid-template-columns:42px 1fr 92px;align-items:center;gap:10px}
.bar-lab{font-size:12px;color:var(--muted);font-weight:600}
.bar-track{background:var(--hair);border-radius:5px;height:14px;overflow:hidden}
.bar-fill{height:100%;border-radius:5px}
.bar-val{font-size:12px;text-align:right;color:var(--ink-soft);font-variant-numeric:tabular-nums}
.bars.age .bar-row{grid-template-columns:58px 1fr 44px}
.stack{display:flex;height:18px;border-radius:6px;overflow:hidden;margin-top:5px}.stack-seg{height:100%}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:12px;color:var(--muted)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle}
.sub-h{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:2px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;color:var(--faint);font-weight:600;font-size:11.5px;padding:6px 8px;border-bottom:1px solid var(--line)}
.tbl th.r{text-align:right}.tbl td{padding:7px 8px;border-bottom:1px solid var(--hair);vertical-align:top}
.tbl td.r{text-align:right}.num{font-variant-numeric:tabular-nums;font-weight:600}.u{font-size:10px;color:var(--faint);margin-left:2px}
.song{font-weight:600}.dt{color:var(--muted);font-size:12px;white-space:nowrap}
.chip{display:inline-block;font-size:11px;background:var(--self-soft);color:var(--self);border-radius:6px;padding:2px 7px;margin:1px 3px 1px 0}
.faint{color:var(--faint)}
.empty{color:var(--faint);font-size:13px;padding:14px;text-align:center;background:var(--panel-2);border-radius:8px}
.note-inline{font-size:11.5px;color:var(--faint);margin:8px 0 0}
.mults{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:12px;margin-top:2px}
.mult{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel-2)}
.mult-h{display:flex;align-items:center;gap:6px;justify-content:space-between}
.mult-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mult-m{font-size:11px;color:var(--faint);margin:2px 0 4px}
.spark{width:100%;height:auto;display:block}
.mult-f{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:3px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.cols{grid-template-columns:1fr}}
.foot{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.foot .avail{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.foot .av{font-size:11px;color:var(--faint);background:var(--panel-2);border:1px solid var(--hair);border-radius:6px;padding:3px 8px}
.tag{display:inline-block;font-size:11px;font-weight:700;color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 40%,var(--line));border-radius:6px;padding:2px 8px;margin-left:8px;vertical-align:middle}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Artist Analytics <span class="tag">たたき台 / 要検証</span></div>
  <h1>${esc(displayName)}</h1>
  <div class="badges">${badges}</div>
  <div class="meta">一次ソース: <b>${primary === 'qlono' ? 'クロノ（SME内部）' : primary === 'gfk' ? 'GfK 国内Streamed Unit' : '未取得'}</b>
   ・海外再生: ${qlono?.overseasByCountry?.length ? 'クロノ world_sales' : '未取得（クロノのみ対応）'}
   ・基準週 ${esc(d.generatedFor || '')}</div>
</header>

<div class="kpis">
${kpis.map(k => `<div class="kpi"><div class="k">${esc(k.k)}</div>
  <div class="v ${k.small ? 'sm' : ''}">${k.v}</div>
  <div class="s">${esc(k.sub || '')}</div>
  ${k.d != null ? `<div class="delta ${k.d >= 0 ? 'up' : 'down'}">${k.d >= 0 ? '▲' : '▼'} ${Math.abs(k.d).toFixed(1)}% 前週比</div>` : ''}
</div>`).join('')}
</div>

${trendPanel}
${top5Panel}
<div class="cols">${overseasPanel}${wikiPanel}</div>
${catalogPanel}
${demoPanel}

<div class="foot">
  <b>データソースと限界</b>（best-effort・取得できた分のみ／数値は捏造なし）
  <div class="avail">
    ${Object.entries(av).filter(([k]) => ['gfk', 'qlono', 'charts', 'wikipedia'].includes(k)).map(([k, v]) => `<span class="av">${k}: ${esc(v)}</span>`).join('')}
  </div>
  <div class="avail">${[...skipped.map(([k, v]) => `${k}: ${esc(v)}`), ...manualList.map(m => esc(m))].map(t => `<span class="av">${t}</span>`).join('')}</div>
  <p style="margin-top:10px">国内再生はクロノ優先→無ければGfK。海外再生はクロノ（SME配給曲）のみ。Wikipedia言語別PVは「海外の検索関心」であり再生数ではない。TikTok UGCは /tiktok-report で別途。</p>
</div>
</div>`;

fs.writeFileSync(outPath, html);
console.log('wrote', outPath, '(', html.length, 'bytes ) primary=', primary);
