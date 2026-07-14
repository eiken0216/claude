// 個別アーティスト・レポート生成: data.json → 統一テンプレの1枚HTML。
// 18本を同一様式で出し、横比較（＝比較レポート）に直結させる。
// 使い方: node report_individual.mjs <data.json> <out.html> ["表示名"]
import fs from 'fs';

const inPath = process.argv[2], outPath = process.argv[3];
const d = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const displayName = process.argv[4] || d.artist;
// 注釈（Web調査で得た正しいタイアップ・再生施策）: --ann <annotations.json>
//   { "tieups": {"曲名": {"label":"...", "src":"..."}}, "campaigns": {"曲名":"※LINE再生キャンペーン等"} }
const annIdx = process.argv.indexOf('--ann');
const ann = (annIdx >= 0 && fs.existsSync(process.argv[annIdx + 1])) ? JSON.parse(fs.readFileSync(process.argv[annIdx + 1], 'utf8')) : {};
const tieups = ann.tieups || {};
const campaigns = ann.campaigns || {};

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

// ---------- 折れ線（インラインSVG）: 目盛り数・最高/最低マーカーをオプション化 ----------
function lineChart(series, { w = 720, h = 210, color = 'var(--self)', fill = 'var(--self-soft)', label = '', yTicks = 5, xTicks = 7, markExtremes = false } = {}) {
  const pts = series.filter(p => p && isFinite(p.v));
  if (pts.length < 2) return `<div class="empty">系列データ不足（未取得）</div>`;
  const pad = { l: 58, r: 16, t: 20, b: 30 };
  const xs = (i) => pad.l + i * (w - pad.l - pad.r) / (pts.length - 1);
  const maxV = Math.max(...pts.map(p => p.v)), minV = Math.min(0, ...pts.map(p => p.v));
  const ys = (v) => h - pad.b - (v - minV) / ((maxV - minV) || 1) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
  const area = `M${xs(0).toFixed(1)},${ys(minV).toFixed(1)} ` + pts.map((p, i) => `L${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ') + ` L${xs(pts.length - 1).toFixed(1)},${ys(minV).toFixed(1)} Z`;
  // 縦目盛り: yTicks段（0〜最高値を等間隔）
  const yv = []; for (let i = 0; i < yTicks; i++) yv.push(maxV * i / (yTicks - 1));
  const gy = yv.map(v => `<line x1="${pad.l}" y1="${ys(v)}" x2="${w - pad.r}" y2="${ys(v)}" class="grid"/><text x="${pad.l - 8}" y="${ys(v) + 3}" class="ytick">${jp(v)}</text>`).join('');
  // 横目盛り: xTicks本（縦の薄いグリッド＋時期ラベル）
  const xiSet = [...new Set(Array.from({ length: xTicks }, (_, k) => Math.round(k * (pts.length - 1) / (xTicks - 1))))];
  const gx = xiSet.map(i => `<line x1="${xs(i)}" y1="${pad.t}" x2="${xs(i)}" y2="${h - pad.b}" class="grid vgrid"/><text x="${xs(i)}" y="${h - 10}" class="xtick" text-anchor="middle">${esc(pts[i].x || '')}</text>`).join('');
  const last = pts[pts.length - 1];
  let marks = `<circle cx="${xs(pts.length - 1)}" cy="${ys(last.v)}" r="3.4" fill="${color}"/>
    <text x="${xs(pts.length - 1) - 4}" y="${ys(last.v) - 8}" class="pointlab" text-anchor="end">${jp(last.v)}</text>`;
  if (markExtremes) {
    const maxI = pts.reduce((a, p, i) => p.v > pts[a].v ? i : a, 0);
    const minI = pts.reduce((a, p, i) => p.v < pts[a].v ? i : a, 0);
    const mk = (i, lab, col, dy) => `<circle cx="${xs(i)}" cy="${ys(pts[i].v)}" r="3.4" fill="none" stroke="${col}" stroke-width="1.8"/>
      <text x="${xs(i)}" y="${ys(pts[i].v) + dy}" class="extlab" fill="${col}" text-anchor="${i > pts.length * 0.82 ? 'end' : i < pts.length * 0.18 ? 'start' : 'middle'}">${lab} ${jp(pts[i].v)}<tspan class="extdate"> ${esc(pts[i].x)}</tspan></text>`;
    marks += mk(maxI, '最高', 'var(--crit)', -9) + (minI !== maxI ? mk(minI, '最低', 'var(--muted)', 15) : '');
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(label)}">
    ${gy}${gx}<path d="${area}" fill="${fill}" stroke="none"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.2"/>
    ${marks}</svg>`;
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

// ---------- 曲別チャート（軸つき・最高値/Rel/スパイク日を明示） ----------
const relFmt = r => { if (!r) return '—'; const s = String(r); return s.includes('-') ? s.slice(0, 10) : s.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'); };
function songChart(pts, color, unit) {
  pts = pts.filter(p => isFinite(p.v));
  if (pts.length < 2) return `<div class="empty" style="padding:8px">データ不足</div>`;
  const w = 340, h = 128, pad = { l: 46, r: 12, t: 14, b: 22 };
  const xs = i => pad.l + i * (w - pad.l - pad.r) / (pts.length - 1);
  const mx = Math.max(...pts.map(p => p.v)) || 1;
  const ys = v => h - pad.b - (v / mx) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
  const area = `M${xs(0).toFixed(1)},${h - pad.b} ` + pts.map((p, i) => `L${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ') + ` L${xs(pts.length - 1).toFixed(1)},${h - pad.b} Z`;
  const pk = pts.reduce((a, p, i) => p.v > pts[a].v ? i : a, 0);
  // 縦目盛り: 0 / 半分 / 最高値
  const gy = [mx, mx / 2, 0].map(v => `<line x1="${pad.l}" y1="${ys(v)}" x2="${w - pad.r}" y2="${ys(v)}" class="grid"/><text x="${pad.l - 5}" y="${ys(v) + 3}" class="ytick sm">${jp(v)}</text>`).join('');
  // 横目盛り: 時期（最初/中間/最後）
  const xi = [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])];
  const gx = xi.map(i => `<text x="${xs(i)}" y="${h - 7}" class="xtick sm" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${esc(pts[i].x)}</text>`).join('');
  // Rel＝データ開始（≒配信）縦線、スパイク＝最高点＋日付
  const rel = `<line x1="${xs(0)}" y1="${pad.t}" x2="${xs(0)}" y2="${h - pad.b}" class="relline"/><text x="${xs(0) + 3}" y="${pad.t + 7}" class="rellab">Rel</text>`;
  const spike = `<circle cx="${xs(pk)}" cy="${ys(pts[pk].v)}" r="3.2" fill="${color}"/><text x="${xs(pk)}" y="${ys(pts[pk].v) - 6}" class="spikelab" text-anchor="${pk > pts.length * 0.7 ? 'end' : 'middle'}">最高 ${jp(pts[pk].v)}<tspan class="extdate"> ${esc(pts[pk].x)}</tspan></text>`;
  return `<svg viewBox="0 0 ${w} ${h}" class="songsvg" role="img">${gy}${gx}<path d="${area}" fill="${color}" opacity="0.12"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.7"/>${rel}${spike}</svg>`;
}
function songMultiples(songs, mode) { // mode: 'daily' | 'weekly'
  const SC = ['var(--self)', 'var(--rival)', '#8a6fd0', 'var(--good)', 'var(--warn)'];
  const unit = mode === 'daily' ? '日' : '週';
  return `<div class="mults">` + songs.map((s, i) => {
    const pts = (s.series || []).map(p => ({ x: mode === 'daily' ? p.date : p.week, v: mode === 'daily' ? p.v : p.total }));
    const peak = Math.max(0, ...pts.map(p => p.v));
    const total = s.total != null ? s.total : pts.reduce((a, p) => a + p.v, 0);
    const tieA = tieups[s.title];
    const tieQ = (s.tieups || [])[0];
    const tieShort = tieA ? tieA.label : (tieQ ? (tieQ.genre || '') : '');
    const tieFull = tieA ? tieA.label : (tieQ ? (tieQ.genre || '') + (tieQ.title ? '：' + tieQ.title : '') : '');
    const camp = campaigns[s.title];
    return `<div class="mult"><div class="mult-h"><span class="mult-t">${i + 1}. ${esc(s.title)}</span>${tieShort ? `<span class="chip" title="${esc(tieFull)}">${esc(tieShort)}</span>` : ''}</div>
      <div class="mult-m">配信 ${esc(relFmt(s.released))} ・ ${mode === 'daily' ? '累計' : '3年計'} ${jp(total)} ・ 最高 ${jp(peak)}/${unit}</div>
      ${songChart(pts, SC[i % SC.length], unit)}
      ${camp ? `<div class="camp">※ ${esc(camp)}</div>` : ''}</div>`;
  }).join('') + `</div>`;
}
let top5Panel = '';
if (qlono?.topSongsDaily?.length) {
  top5Panel = `<section class="panel"><div class="panel-h"><h2>人気曲5曲・デイリー推移（リリース〜現在）</h2><span class="src">クロノ world_sales 日次・全期間</span></div>
    ${songMultiples(qlono.topSongsDaily, 'daily')}
    <p class="note-inline">縦＝日次再生（最高値を目盛りに）。Rel＝配信、点＝スパイク（最高）日。チップ＝タイアップ。※＝配信周辺の再生施策（Web調査で確認できた曲のみ）。</p></section>`;
} else if (gfk?.topSongsWeekly?.length) {
  const relMap = Object.fromEntries((gfk.catalog || []).map(c => [c.title, c.release]));
  const songs = gfk.topSongsWeekly.map(s => ({ ...s, released: s.released || relMap[s.title] }));
  top5Panel = `<section class="panel"><div class="panel-h"><h2>人気曲5曲・ウィークリー推移（リリース〜現在）</h2><span class="src">GfK 週次・3年・曲別デイリーは非SME不可</span></div>
    ${songMultiples(songs, 'weekly')}
    <p class="note-inline">非SME配給のため曲別デイリーは取得不可 → GfK週次（3年）でリリース〜現在を表示。縦＝週次再生（最高値を目盛りに）、Rel＝データ開始週、点＝スパイク週。GfKは曲名単位集計。※＝配信周辺の再生施策（Web調査）。</p></section>`;
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
  const vals = mo.map(m => m.artistTotal);
  const last = vals[vals.length - 1], first = vals[0];
  const peak = Math.max(...vals), peakMo = mo.find(m => m.artistTotal === peak);
  const bottom = Math.min(...vals), botMo = mo.find(m => m.artistTotal === bottom);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const growth = first ? last / first : 0;
  trendPanel = `<section class="panel">
    <div class="panel-h"><h2>国内サブスク推移（直近3年）</h2><span class="src">GfK Streamed Unit・月次・${mo.length}ヶ月</span></div>
    ${lineChart(series, { label: '国内サブスク月次推移3年', yTicks: 5, xTicks: 7, markExtremes: true })}
    <div class="mini-row">
      <div class="mini"><span>最高（${esc(peakMo?.month || '')}）</span><b>${jp(peak)}</b></div>
      <div class="mini"><span>最低（${esc(botMo?.month || '')}）</span><b>${jp(bottom)}</b></div>
      <div class="mini"><span>直近月（${esc(mo[mo.length - 1].month)}）</span><b>${jp(last)}</b></div>
      <div class="mini"><span>月平均</span><b>${jp(avg)}</b></div>
      <div class="mini"><span>3年成長</span><b class="${last >= first ? 'up' : 'down'}">${first ? (growth >= 10 ? '×' + growth.toFixed(0) : (pct(last, first) >= 0 ? '+' : '') + pct(last, first).toFixed(0) + '%') : '—'}</b></div>
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

// ---------- カタログ上位曲（再生＋最高値＋配信日＋Web確認タイアップ＋再生施策※） ----------
let catalogPanel = '';
const cat = qlono?.catalog?.length ? qlono.catalog.map(x => ({ title: x.title, v: x.total28d, unit: '/28日', rel: x.released, tie: x.tieups || [], peak: x.peakDaily, peakUnit: '/日' }))
  : (gfk?.catalog || []).map(x => ({ title: x.title, v: x.total, unit: '/週', rel: x.release, tie: [], peak: x.peakWeekly, peakUnit: '/週' }));
if (cat.length) {
  const src = qlono?.catalog?.length ? 'クロノ（28日＋デイリー最高＋タイアップ）' : 'GfK（最新週＋週次最高）';
  const usedCamps = cat.slice(0, 10).filter(r => campaigns[r.title]);
  catalogPanel = `<section class="panel">
    <div class="panel-h"><h2>カタログ上位曲</h2><span class="src">${src}</span></div>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>曲</th><th class="r">再生</th><th class="r">最高</th><th>配信日</th><th>タイアップ（Web確認）</th></tr></thead><tbody>
    ${cat.slice(0, 10).map(r => {
    const tieA = tieups[r.title];
    const tieCell = tieA ? `<span class="chip" title="${esc(tieA.label)}">${esc(tieA.label)}</span>` : ((r.tie || []).length ? r.tie.map(t => `<span class="chip">${esc(t.genre || '')}${t.title ? '：' + esc(t.title) : ''}</span>`).join('') : '<span class="faint">なし/未確認</span>');
    const camp = campaigns[r.title];
    return `<tr><td class="song">${esc(r.title)}${camp ? '<span class="star" title="' + esc(camp) + '">※</span>' : ''}</td>
      <td class="r num">${jp(r.v)}<span class="u">${r.unit}</span></td>
      <td class="r num">${r.peak ? jp(r.peak) + '<span class="u">' + r.peakUnit + '</span>' : '<span class="faint">—</span>'}</td>
      <td class="dt">${r.rel ? esc(String(r.rel).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3').slice(0, 10)) : '—'}</td>
      <td class="tie">${tieCell}</td></tr>`;
  }).join('')}
    </tbody></table></div>
    ${usedCamps.length ? `<p class="note-inline">※＝配信周辺で再生数を直接押し上げる施策（LINE MUSIC再生キャンペーン等）をWeb調査で確認できた曲。${usedCamps.map(r => `<br><b>${esc(r.title)}</b>：${esc(campaigns[r.title])}`).join('')}</p>` : `<p class="note-inline">タイアップはWeb調査で確認したもののみ記載（正確性優先）。「最高」＝${qlono?.catalog?.length ? 'デイリー' : '週次'}の期間最高値。</p>`}</section>`;
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
.mults{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px;margin-top:2px}
.mult{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel-2)}
.mult-h{display:flex;align-items:center;gap:6px;justify-content:space-between}
.mult-t{font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mult-m{font-size:11px;color:var(--faint);margin:2px 0 4px}
.songsvg{width:100%;height:auto;display:block;overflow:visible}
.camp{font-size:10.5px;color:var(--warn);margin-top:5px;line-height:1.4}
.vgrid{opacity:.55}
.ytick.sm,.xtick.sm{font-size:9px}
.pointlab{fill:var(--ink-soft);font-size:11px;font-weight:700}
.extlab{font-size:10px;font-weight:700}.extdate{font-size:8.5px;font-weight:500;opacity:.8}
.relline{stroke:var(--good);stroke-width:1;stroke-dasharray:2 2;opacity:.7}
.rellab{fill:var(--good);font-size:8.5px;font-weight:700}
.spikelab{fill:var(--ink-soft);font-size:9.5px;font-weight:700}
.star{color:var(--warn);font-weight:700;margin-left:3px;cursor:help}
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
