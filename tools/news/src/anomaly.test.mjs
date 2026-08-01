import test from 'node:test';
import assert from 'node:assert/strict';

import { detectSpike, describeSpike } from './anomaly.mjs';

/** n日ぶんの系列を作る。valuesAt(i) が i 日目の値。 */
function series(n, valueAt, start = '2026-07-01') {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(base + i * 86400000).toISOString().slice(0, 10),
    value: valueAt(i),
  }));
}

test('データが無ければ no_data', () => {
  assert.equal(detectSpike([]).status, 'no_data');
});

test('履歴が足りないうちは判定しない', () => {
  const r = detectSpike(series(3, (i) => 1000 + i * 10));
  assert.equal(r.status, 'warming_up');
  assert.equal(r.isSpike, undefined);
});

test('delta モード: 一定ペースの増加はスパイクにしない', () => {
  // 毎日きっかり +100 ずつ増えるフォロワー数
  const r = detectSpike(series(20, (i) => 10_000 + i * 100));
  assert.equal(r.status, 'ok');
  assert.equal(r.isSpike, false);
  assert.equal(r.delta, 100);
});

test('delta モード: 平常の10倍伸びた日をスパイクとして拾う', () => {
  const points = series(20, (i) => 10_000 + i * 100);
  // 最終日だけ +1000（平常は +100）
  points[points.length - 1].value += 900;

  const r = detectSpike(points);
  assert.equal(r.isSpike, true);
  assert.equal(r.direction, 'up');
  assert.equal(r.delta, 1000);
  assert.ok(r.z > 3, `z が想定より小さい: ${r.z}`);
  assert.equal(r.severity, 'high');
});

test('delta モード: 落ち込みも検知して direction=down を返す', () => {
  const points = series(20, (i) => 10_000 + i * 100);
  points[points.length - 1].value -= 900; // 最終日だけ -800

  const r = detectSpike(points);
  assert.equal(r.isSpike, true);
  assert.equal(r.direction, 'down');
  assert.ok(r.z < -2);
});

test('level モード: 値そのものの跳ね上がりを検知する', () => {
  // 24hのUGC投稿数が毎日 20 前後 → 最終日だけ 200
  const points = series(20, (i) => 20 + (i % 3));
  points[points.length - 1].value = 200;

  const r = detectSpike(points, { mode: 'level' });
  assert.equal(r.isSpike, true);
  assert.equal(r.direction, 'up');
  assert.equal(r.value, 200);
});

test('level モード: 平常範囲の揺れはスパイクにしない', () => {
  const points = series(20, (i) => 20 + (i % 3));
  const r = detectSpike(points, { mode: 'level' });
  assert.equal(r.isSpike, false);
});

test('完全に一定の系列でも z が発散しない', () => {
  const r = detectSpike(series(20, () => 500), { mode: 'level' });
  assert.equal(r.isSpike, false);
  assert.ok(Number.isFinite(r.z));
});

test('日付が飛んでいる場合は1日あたりに正規化する', () => {
  // 平日のみ観測（土日は欠測）でも、月曜の +300 を「3日ぶんで+100/日」と扱う
  const points = [
    { date: '2026-07-01', value: 1000 },
    { date: '2026-07-02', value: 1100 },
    { date: '2026-07-03', value: 1200 },
    { date: '2026-07-06', value: 1500 }, // 3日ぶん = +100/日
    { date: '2026-07-07', value: 1600 },
    { date: '2026-07-08', value: 1700 },
    { date: '2026-07-09', value: 1800 },
  ];
  const r = detectSpike(points);
  assert.equal(r.isSpike, false, '欠測日を跨いだ増分を異常と誤判定している');
});

test('describeSpike は判定結果を1行にまとめる', () => {
  const points = series(20, (i) => 10_000 + i * 100);
  points[points.length - 1].value += 900;

  const line = describeSpike('Spotify フォロワー', detectSpike(points), { unit: '人' });
  assert.match(line, /⤴/);
  assert.match(line, /Spotify フォロワー/);
  assert.match(line, /z=/);
});
