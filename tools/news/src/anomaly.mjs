/**
 * 時系列スナップショットから異常値（スパイク）を検知する。
 *
 * 指標には2種類ある:
 *   - mode: 'delta'  累積値（フォロワー数・総再生数）→ 「1日あたりの増分」を見る
 *   - mode: 'level'  瞬間値（人気度スコア・24hのUGC投稿数）→ 「値そのもの」を見る
 *
 * どちらも直近 window 本の観測から平均 μ と標準偏差 σ を取り、
 * 当日の観測が μ ± z·σ を外れたらスパイクとして報告する。
 * 履歴が足りないうちは判定せず「ベースライン構築中」を返す。
 */

const DEFAULTS = {
  mode: 'delta',
  minSamples: 6, // これ未満のスナップショット数では判定しない
  window: 21, // ベースラインに使う直近の観測本数
  z: 2.0, // これを超えたらスパイク
  minAbsDelta: 0, // 前日比がこれ未満ならノイズとして無視
};

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/**
 * @param {Array<{date: string, value: number}>} series 日付昇順のスナップショット
 * @param {object} [opts]
 */
export function detectSpike(series, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  const clean = series
    .filter((p) => p && typeof p.value === 'number' && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (clean.length === 0) return { status: 'no_data', samples: 0, mode: cfg.mode };

  const latest = clean[clean.length - 1];
  const base = {
    status: 'ok',
    mode: cfg.mode,
    samples: clean.length,
    value: latest.value,
    date: latest.date,
  };

  if (clean.length < 2) {
    return { ...base, status: 'warming_up', reason: '初回スナップショット' };
  }

  // 前日比（表示用。判定には mode に応じた観測列を使う）
  const prev = clean[clean.length - 2];
  const gap = Math.max(1, daysBetween(prev.date, latest.date));
  const delta = latest.value - prev.value;
  const withDelta = {
    ...base,
    delta,
    deltaPerDay: delta / gap,
    pct: prev.value !== 0 ? (delta / Math.abs(prev.value)) * 100 : null,
  };

  if (clean.length < cfg.minSamples) {
    return {
      ...withDelta,
      status: 'warming_up',
      reason: `ベースライン構築中 (${clean.length}/${cfg.minSamples}日分)`,
    };
  }

  const observations =
    cfg.mode === 'level'
      ? clean.map((p) => p.value)
      : clean.slice(1).map((p, i) => {
          const days = Math.max(1, daysBetween(clean[i].date, p.date));
          return (p.value - clean[i].value) / days;
        });

  const current = observations[observations.length - 1];
  const history = observations.slice(0, -1).slice(-cfg.window);
  const mu = mean(history);
  const sigma = stdev(history);

  // σ が 0 に近いと z が発散するので、平均の1%を下限に使う
  const effectiveSigma = Math.max(sigma, Math.abs(mu) * 0.01, 1e-9);
  const z = (current - mu) / effectiveSigma;

  const isSpike = Math.abs(delta) >= cfg.minAbsDelta && Math.abs(z) >= cfg.z;

  return {
    ...withDelta,
    z,
    observation: current,
    baseline: { mean: mu, stdev: sigma, n: history.length },
    isSpike,
    direction: current >= mu ? 'up' : 'down',
    severity: !isSpike ? 'normal' : Math.abs(z) >= 3 ? 'high' : 'medium',
  };
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.abs(n) < 10 ? Math.round(n * 100) / 100 : Math.round(n);
  return rounded.toLocaleString('ja-JP');
}

function signed(n) {
  return `${n >= 0 ? '+' : '−'}${formatNumber(Math.abs(n))}`;
}

/** 検知結果を人が読める1行にする */
export function describeSpike(label, result, { unit = '' } = {}) {
  if (!result || result.status === 'no_data') return `${label}: データなし`;

  const value = `${formatNumber(result.value)}${unit}`;

  if (result.status === 'warming_up') {
    const d = result.delta != null ? `（前日比 ${signed(result.delta)}${unit}）` : '';
    return `${label}: ${value}${d} — ${result.reason}`;
  }

  const arrow = result.isSpike ? (result.direction === 'up' ? '⤴' : '⤵') : '→';
  const pct =
    result.pct != null && Math.abs(result.pct) >= 0.01
      ? ` / ${result.pct >= 0 ? '+' : ''}${result.pct.toFixed(2)}%`
      : '';
  const baseline =
    result.mode === 'level'
      ? `平常 ${formatNumber(result.baseline.mean)}${unit}`
      : `平常 ${signed(result.baseline.mean)}${unit}/日`;

  return `${arrow} ${label}: ${value}（前日比 ${signed(result.delta)}${unit}${pct} / ${baseline} / z=${result.z.toFixed(1)}）`;
}
