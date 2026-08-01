import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

/** 日本時間の YYYY-MM-DD */
export function todayJST(now = new Date()) {
  // sv-SE ロケールは YYYY-MM-DD 形式を返す
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
}

/** 日本時間の曜日 (0=日 .. 6=土) */
export function weekdayJST(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** 日本時間の "2026年8月1日(金)" 形式 */
export function displayDateJST(now = new Date()) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}年${get('month')}月${get('day')}日(${get('weekday')})`;
}

async function ensureDir(file) {
  await mkdir(path.dirname(file), { recursive: true });
}

/** JSONL を配列で読む。ファイルが無ければ空配列。壊れた行は捨てる。 */
export async function readJsonl(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // 壊れた行は無視（履歴の1行が壊れても配信は止めない）
    }
  }
  return out;
}

/** JSONL に1行追記する。同じ date の行が既にあれば追記しない（同日再実行の重複防止）。 */
export async function appendJsonl(file, record) {
  const existing = await readJsonl(file);
  if (record.date && existing.some((r) => r.date === record.date)) {
    // 同日の再実行: 最新値で置き換える
    const replaced = existing.map((r) => (r.date === record.date ? record : r));
    await ensureDir(file);
    await writeFile(file, replaced.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    return;
  }
  await ensureDir(file);
  await appendFile(file, JSON.stringify(record) + '\n', 'utf8');
}

export async function writeText(file, text) {
  await ensureDir(file);
  await writeFile(file, text, 'utf8');
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}
