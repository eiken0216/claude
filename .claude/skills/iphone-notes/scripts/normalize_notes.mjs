#!/usr/bin/env node
// Normalize exported Apple Notes files into JSONL + CSV + per-note markdown.
//
//   node normalize_notes.mjs --in notes_inbox --out data/notes
//
// Accepts .txt .md .markdown .html .htm .enex .eml anywhere under --in.
// Subfolder path becomes the note's folder unless the file carries its own
// metadata (notes-meta comment in HTML, YAML frontmatter in md, headers in
// eml/enex). Exact duplicates (same title+body) are skipped so Gmail-sync
// and Mac-export imports can be combined.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EXTS = new Set(['.txt', '.md', '.markdown', '.html', '.htm', '.enex', '.eml']);

function parseArgs(argv) {
  const args = { in: 'notes_inbox', out: 'data/notes' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return args;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (EXTS.has(path.extname(entry.name).toLowerCase())) out.push(p);
  }
  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function htmlToText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|ul|ol|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function toIso(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// "20240101T120000Z" (ENEX) → ISO
function enexDate(v) {
  if (!v) return null;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return toIso(v);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// --- quoted-printable / RFC2047 (best effort, assumes UTF-8) ---

function qpDecode(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '=') {
      if (s[i + 1] === '\r' && s[i + 2] === '\n') { i += 2; continue; }
      if (s[i + 1] === '\n') { i += 1; continue; }
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue; }
    }
    bytes.push(...Buffer.from(c, 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

function rfc2047Decode(s) {
  return s.replace(/=\?[^?]+\?([BQ])\?([^?]*)\?=/gi, (_, enc, data) => {
    if (enc.toUpperCase() === 'B') return Buffer.from(data, 'base64').toString('utf8');
    return qpDecode(data.replace(/_/g, ' '));
  });
}

// --- per-format parsers; each returns an array of note objects ---

function noteFromText(raw, file, stat, folder) {
  let body = raw.replace(/^﻿/, '').trim();
  let meta = {};
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
    }
    body = body.slice(fm[0].length).trim();
  }
  const firstLine = (body.split('\n').find((l) => l.trim()) || '').replace(/^#+\s*/, '').trim();
  return [{
    title: meta.title || firstLine.slice(0, 100) || path.basename(file, path.extname(file)),
    folder: meta.folder || folder,
    created: toIso(meta.created) || stat.birthtime.toISOString(),
    modified: toIso(meta.modified) || stat.mtime.toISOString(),
    body,
  }];
}

function noteFromHtml(raw, file, stat, folder) {
  let meta = {};
  const m = raw.match(/<!--\s*notes-meta:\s*(\{[\s\S]*?\})\s*-->/);
  if (m) {
    try { meta = JSON.parse(m[1]); } catch { /* malformed meta — fall back to heuristics */ }
  }
  const titleTag = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const body = htmlToText(raw);
  const firstLine = (body.split('\n').find((l) => l.trim()) || '').trim();
  return [{
    title: meta.title || (titleTag && htmlToText(titleTag[1])) || firstLine.slice(0, 100) || path.basename(file, path.extname(file)),
    folder: meta.folder || folder,
    created: toIso(meta.created) || stat.birthtime.toISOString(),
    modified: toIso(meta.modified) || stat.mtime.toISOString(),
    body,
  }];
}

function notesFromEnex(raw, file, stat, folder) {
  const out = [];
  for (const [, chunk] of raw.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const pick = (tag) => {
      const mm = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return mm ? mm[1] : null;
    };
    const cdata = chunk.match(/<content[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/content>/);
    const contentHtml = cdata ? (cdata[1] ?? cdata[2] ?? '') : '';
    out.push({
      title: decodeEntities(pick('title') || '').trim() || path.basename(file, path.extname(file)),
      folder,
      created: enexDate(pick('created')) || stat.birthtime.toISOString(),
      modified: enexDate(pick('updated')) || stat.mtime.toISOString(),
      body: htmlToText(contentHtml),
    });
  }
  return out;
}

function noteFromEml(raw, file, stat, folder) {
  const sep = raw.search(/\r?\n\r?\n/);
  const headerBlock = (sep === -1 ? raw : raw.slice(0, sep)).replace(/\r?\n[ \t]+/g, ' ');
  let bodyRaw = sep === -1 ? '' : raw.slice(sep).replace(/^\r?\n\r?\n/, '');
  const header = (name) => {
    const mm = headerBlock.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
    return mm ? mm[1].trim() : null;
  };
  let contentType = header('content-type') || 'text/plain';
  let cte = (header('content-transfer-encoding') || '').toLowerCase();

  const boundary = contentType.match(/boundary="?([^";]+)"?/i);
  if (boundary) {
    const parts = bodyRaw.split(new RegExp(`--${boundary[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`));
    let best = null;
    for (const part of parts) {
      const pSep = part.search(/\r?\n\r?\n/);
      if (pSep === -1) continue;
      const pHead = part.slice(0, pSep).replace(/\r?\n[ \t]+/g, ' ');
      const pType = (pHead.match(/content-type:\s*([^;\r\n]+)/i) || [])[1] || '';
      if (/text\/plain/i.test(pType) || (!best && /text\/html/i.test(pType))) {
        best = {
          html: /text\/html/i.test(pType),
          cte: ((pHead.match(/content-transfer-encoding:\s*(\S+)/i) || [])[1] || '').toLowerCase(),
          body: part.slice(pSep).trim(),
        };
        if (!best.html) break;
      }
    }
    if (best) {
      bodyRaw = best.body;
      cte = best.cte;
      contentType = best.html ? 'text/html' : 'text/plain';
    }
  }

  let body = bodyRaw;
  if (cte === 'base64') body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  else if (cte === 'quoted-printable') body = qpDecode(body);
  if (/text\/html/i.test(contentType)) body = htmlToText(body);
  body = body.trim();

  const date = toIso(header('date'));
  return [{
    title: rfc2047Decode(header('subject') || '').trim() || path.basename(file, path.extname(file)),
    folder,
    created: date || stat.birthtime.toISOString(),
    modified: date || stat.mtime.toISOString(),
    body,
  }];
}

// --- output helpers ---

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function slugify(title) {
  const s = title
    .normalize('NFKC')
    .replace(/[\/\\:*?"<>|#%{}$!'`&\s]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'note';
}

// --- main ---

const args = parseArgs(process.argv);
const inDir = path.resolve(args.in);
const outDir = path.resolve(args.out);

if (!fs.existsSync(inDir)) {
  console.error(`Input directory not found: ${inDir}`);
  process.exit(1);
}

const files = walk(inDir);
const notes = [];
let dupes = 0;
const seen = new Set();
const warnings = [];

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const folder = path.relative(inDir, path.dirname(file)) || '';
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    warnings.push(`unreadable: ${file} (${e.message})`);
    continue;
  }
  let parsed = [];
  try {
    if (ext === '.enex') parsed = notesFromEnex(raw, file, stat, folder);
    else if (ext === '.eml') parsed = noteFromEml(raw, file, stat, folder);
    else if (ext === '.html' || ext === '.htm') parsed = noteFromHtml(raw, file, stat, folder);
    else parsed = noteFromText(raw, file, stat, folder);
  } catch (e) {
    warnings.push(`failed to parse: ${file} (${e.message})`);
    continue;
  }
  for (const n of parsed) {
    n.body = (n.body || '').replace(/\r\n?/g, '\n');
    if (!n.body && !n.title) continue;
    const hash = crypto.createHash('sha1').update(`${n.title}\n${n.body}`).digest('hex');
    if (seen.has(hash)) { dupes++; continue; }
    seen.add(hash);
    notes.push({ ...n, source: path.relative(inDir, file), chars: n.body.length });
  }
}

notes.sort((a, b) => (a.created || '').localeCompare(b.created || ''));
notes.forEach((n, i) => { n.id = String(i + 1).padStart(4, '0'); });

fs.mkdirSync(path.join(outDir, 'md'), { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'notes.jsonl'),
  notes.map((n) => JSON.stringify({ id: n.id, title: n.title, folder: n.folder, created: n.created, modified: n.modified, source: n.source, chars: n.chars, body: n.body })).join('\n') + (notes.length ? '\n' : ''),
);

fs.writeFileSync(
  path.join(outDir, 'index.csv'),
  ['id,title,folder,created,modified,chars,source',
    ...notes.map((n) => [n.id, n.title, n.folder, n.created, n.modified, n.chars, n.source].map(csvCell).join(',')),
  ].join('\n') + '\n',
);

for (const n of notes) {
  fs.writeFileSync(
    path.join(outDir, 'md', `${n.id}-${slugify(n.title)}.md`),
    `---\ntitle: ${n.title}\nfolder: ${n.folder}\ncreated: ${n.created}\nmodified: ${n.modified}\nsource: ${n.source}\n---\n\n${n.body}\n`,
  );
}

const dates = notes.map((n) => n.created).filter(Boolean).sort();
console.log(`notes:      ${notes.length}`);
console.log(`duplicates: ${dupes} skipped`);
console.log(`files read: ${files.length}`);
console.log(`date range: ${dates[0] || '-'} .. ${dates[dates.length - 1] || '-'}`);
console.log(`total text: ${notes.reduce((a, n) => a + n.chars, 0)} chars`);
console.log(`output:     ${path.relative(process.cwd(), outDir)}/{notes.jsonl,index.csv,md/}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (notes.length === 0) {
  console.warn('No notes found. Put exported note files under ' + path.relative(process.cwd(), inDir) + '/ first.');
  process.exitCode = 2;
}
