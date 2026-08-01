/**
 * メール本文の組み立て。
 * Outlook（デスクトップ版は Word のレンダリングエンジン）で崩れないよう、
 * table レイアウト + インラインCSS のみで作る。flex / grid / <style> は使わない。
 */

const COLORS = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#e4e4e4',
  bg: '#f6f6f4',
  card: '#ffffff',
  accent: '#1f3a93',
  alertBg: '#fff4e5',
  alertLine: '#e08e00',
  alertInk: '#8a5300',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stars(n) {
  const v = Math.max(1, Math.min(5, Number(n) || 1));
  return '●'.repeat(v) + '○'.repeat(5 - v);
}

function jstTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/* ---------------------------------------------------------------- HTML --- */

export function renderHtml(report) {
  const { dateLabel, brief, anomalyNote, artists, sections, failures, meta } = report;

  const parts = [];

  parts.push(`<div style="margin:0;padding:0;background-color:${COLORS.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};padding:16px 8px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:100%;background-color:${COLORS.card};border:1px solid ${COLORS.line};border-radius:6px;font-family:-apple-system,'Segoe UI','Hiragino Sans','Yu Gothic UI',Meiryo,sans-serif;color:${COLORS.ink};">`);

  // ヘッダー
  parts.push(`<tr><td style="padding:24px 28px 16px 28px;border-bottom:2px solid ${COLORS.accent};">
<div style="font-size:12px;letter-spacing:.08em;color:${COLORS.muted};text-transform:uppercase;">Daily Brief</div>
<div style="font-size:22px;font-weight:700;padding-top:4px;">${esc(dateLabel)}</div>
</td></tr>`);

  // 今日のまとめ
  if (brief) {
    parts.push(`<tr><td style="padding:20px 28px 4px 28px;">
<div style="font-size:15px;line-height:1.75;">${esc(brief).replace(/\n/g, '<br>')}</div>
</td></tr>`);
  }

  // アーティスト指標
  if (artists.length > 0) {
    parts.push(sectionHeading('担当アーティストの動き'));

    if (anomalyNote) {
      parts.push(`<tr><td style="padding:0 28px 12px 28px;">
<div style="font-size:14px;line-height:1.7;color:${COLORS.ink};background-color:${COLORS.bg};border-left:3px solid ${COLORS.accent};padding:12px 14px;border-radius:0 4px 4px 0;">${esc(anomalyNote).replace(/\n/g, '<br>')}</div>
</td></tr>`);
    }

    for (const artist of artists) {
      parts.push(renderArtistHtml(artist));
    }
  }

  // ニュース
  for (const section of sections) {
    if (section.items.length === 0) continue;
    parts.push(sectionHeading(section.label));
    parts.push(`<tr><td style="padding:0 28px;">`);
    for (const item of section.items) {
      parts.push(renderItemHtml(item));
    }
    parts.push(`</td></tr>`);
  }

  // フッター
  parts.push(renderFooterHtml({ failures, meta }));

  parts.push(`</table>
</td></tr>
</table>
</div>`);

  return parts.join('\n');
}

function sectionHeading(label) {
  return `<tr><td style="padding:24px 28px 10px 28px;">
<div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:${COLORS.accent};border-bottom:1px solid ${COLORS.line};padding-bottom:6px;">${esc(label)}</div>
</td></tr>`;
}

function renderArtistHtml(artist) {
  const alert = artist.spikes.length > 0;
  const border = alert ? COLORS.alertLine : COLORS.line;
  const bg = alert ? COLORS.alertBg : COLORS.card;

  const rows = artist.metrics
    .map(
      (m) =>
        `<tr><td style="padding:3px 0;font-size:13px;line-height:1.6;color:${
          m.spike ? COLORS.alertInk : COLORS.ink
        };font-weight:${m.spike ? '600' : '400'};">${esc(m.text)}</td></tr>`,
    )
    .join('');

  const links = artist.links
    .map(
      (l) =>
        `<a href="${esc(l.url)}" style="color:${COLORS.accent};text-decoration:none;font-size:12px;">${esc(l.label)}</a>`,
    )
    .join(`<span style="color:${COLORS.muted};font-size:12px;"> · </span>`);

  const highlights = artist.highlights?.length
    ? `<tr><td style="padding-top:8px;">
${artist.highlights
  .map(
    (h) =>
      `<div style="font-size:12px;line-height:1.6;color:${COLORS.muted};padding-bottom:2px;">[${esc(h.kind)}] <a href="${esc(h.url)}" style="color:${COLORS.accent};text-decoration:none;">${esc(h.title)}</a>${h.meta ? ` — ${esc(h.meta)}` : ''}</div>`,
  )
  .join('\n')}
</td></tr>`
    : '';

  return `<tr><td style="padding:0 28px 10px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};border:1px solid ${border};border-radius:5px;">
<tr><td style="padding:14px 16px;">
<div style="font-size:15px;font-weight:700;padding-bottom:6px;">${alert ? '⚠ ' : ''}${esc(artist.name)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}${highlights}</table>
${links ? `<div style="padding-top:8px;">${links}</div>` : ''}
</td></tr>
</table>
</td></tr>`;
}

function renderItemHtml(item) {
  const meta = [item.source, item.published ? jstTime(item.published) : null]
    .filter(Boolean)
    .join(' · ');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
<tr><td style="padding-bottom:2px;">
<span style="font-size:11px;color:${COLORS.muted};letter-spacing:.05em;">${stars(item.importance)}</span>
<span style="font-size:11px;color:${COLORS.muted};"> ${esc(meta)}</span>
</td></tr>
<tr><td style="padding-bottom:4px;">
<a href="${esc(item.link)}" style="font-size:15px;font-weight:600;color:${COLORS.ink};text-decoration:none;line-height:1.5;">${esc(item.headline)}</a>
</td></tr>
${
  item.summary
    ? `<tr><td style="font-size:13px;line-height:1.7;color:${COLORS.ink};padding-bottom:4px;">${esc(item.summary)}</td></tr>`
    : ''
}
${
  item.why
    ? `<tr><td style="font-size:13px;line-height:1.7;color:${COLORS.accent};">→ ${esc(item.why)}</td></tr>`
    : ''
}
</table>`;
}

function renderFooterHtml({ failures, meta }) {
  const notes = [];
  if (failures.length > 0) {
    notes.push(
      `取得できなかったフィード: ${failures.map((f) => `${esc(f.feed)}（${esc(f.error)}）`).join(' / ')}`,
    );
  }
  if (meta?.length) notes.push(...meta.map(esc));

  return `<tr><td style="padding:20px 28px 24px 28px;border-top:1px solid ${COLORS.line};">
${notes.map((n) => `<div style="font-size:11px;line-height:1.6;color:${COLORS.muted};">${n}</div>`).join('\n')}
<div style="font-size:11px;color:${COLORS.muted};padding-top:8px;">このメールは GitHub Actions から平日朝8時（JST）に自動配信されています。配信内容の調整はリポジトリの <code>tools/news/config/</code> を編集してください。</div>
</td></tr>`;
}

/* ------------------------------------------------------- プレーンテキスト --- */

export function renderText(report) {
  const { dateLabel, brief, anomalyNote, artists, sections, failures } = report;
  const out = [`■ Daily Brief — ${dateLabel}`, ''];

  if (brief) out.push(brief, '');

  if (artists.length > 0) {
    out.push('── 担当アーティストの動き ──');
    if (anomalyNote) out.push(anomalyNote, '');
    for (const a of artists) {
      out.push(`${a.spikes.length ? '[!] ' : ''}${a.name}`);
      for (const m of a.metrics) out.push(`   ${m.text}`);
      for (const h of a.highlights ?? []) {
        out.push(`   [${h.kind}] ${h.title}${h.meta ? ` — ${h.meta}` : ''}`);
        out.push(`     ${h.url}`);
      }
      out.push('');
    }
  }

  for (const section of sections) {
    if (section.items.length === 0) continue;
    out.push(`── ${section.label} ──`);
    for (const item of section.items) {
      out.push(`${stars(item.importance)} ${item.headline}`);
      out.push(`   ${item.source}${item.published ? ` / ${jstTime(item.published)}` : ''}`);
      if (item.summary) out.push(`   ${item.summary}`);
      if (item.why) out.push(`   → ${item.why}`);
      out.push(`   ${item.link}`);
      out.push('');
    }
  }

  if (failures.length > 0) {
    out.push('── 取得できなかったフィード ──');
    for (const f of failures) out.push(`   ${f.feed}: ${f.error}`);
  }

  return out.join('\n');
}

/* ----------------------------------------------------------- Markdown --- */

export function renderMarkdown(report) {
  const { dateLabel, brief, anomalyNote, artists, sections, failures } = report;
  const out = [`# Daily Brief — ${dateLabel}`, ''];

  if (brief) out.push(brief, '');

  if (artists.length > 0) {
    out.push('## 担当アーティストの動き', '');
    if (anomalyNote) out.push(`> ${anomalyNote.replace(/\n/g, '\n> ')}`, '');
    for (const a of artists) {
      out.push(`### ${a.spikes.length ? '⚠️ ' : ''}${a.name}`, '');
      for (const m of a.metrics) out.push(`- ${m.text}`);
      for (const h of a.highlights ?? []) {
        out.push(`- \`${h.kind}\` [${h.title}](${h.url})${h.meta ? ` — ${h.meta}` : ''}`);
      }
      out.push('');
    }
  }

  for (const section of sections) {
    if (section.items.length === 0) continue;
    out.push(`## ${section.label}`, '');
    for (const item of section.items) {
      out.push(`### ${item.headline}`);
      out.push(
        `\`${stars(item.importance)}\` ${item.source}${item.published ? ` · ${jstTime(item.published)}` : ''} · [記事を開く](${item.link})`,
        '',
      );
      if (item.summary) out.push(item.summary, '');
      if (item.why) out.push(`**→ ${item.why}**`, '');
    }
  }

  if (failures.length > 0) {
    out.push('---', '', '取得できなかったフィード:', '');
    for (const f of failures) out.push(`- ${f.feed}: ${f.error}`);
  }

  return out.join('\n');
}
