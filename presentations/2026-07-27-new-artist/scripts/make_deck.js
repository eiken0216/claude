// Google スライド用 .pptx を生成（Drive アップロード時に Google Slides へ変換）
const PptxGenJS = require("pptxgenjs");
const { MEETING, ARTISTS, PENDING, SUMMARY_ROWS, CLOSING } = require("./data.js");
const IMG = require("fs").existsSync("./image_manifest.json")
  ? JSON.parse(require("fs").readFileSync("./image_manifest.json", "utf8")) : {};
const pic = (name, key) => (IMG[name] || {})[key] || null;
const refPic = (name, i) => (((IMG[name] || {}).refs) || {})[String(i)] || null;

// ── パレット ────────────────────────────────────────────────────────────────
const DARK = "171226";      // 主背景（濃）
const CARD_D = "271C47";    // 濃背景上のカード
const LIGHT = "FFFFFF";
const CARD_L = "F4F2F8";    // 淡背景上のカード
const INK = "1B1730";
const MUTE_D = "A9A4C0";    // 濃背景上の弱色
const MUTE_L = "6B6880";    // 淡背景上の弱色
const DECK = "FF4D6D";

const W = 13.3, H = 7.5;
const M = 0.6;                 // 左右マージン
const CW = W - M * 2;          // 12.1

// ── ヘルパ ──────────────────────────────────────────────────────────────────
// 長文をスライド用に1文へ圧縮
function brief(t, max = 104) {
  const parts = String(t).split("。").filter(Boolean);
  let out = parts[0] + "。";
  for (let i = 1; i < parts.length && out.length + parts[i].length + 1 <= max; i++) out += parts[i] + "。";
  if (out.length > max) out = out.slice(0, max - 1) + "…";
  return out;
}

// 文字列配列 → pptxgenjs の箇条書きテキストオブジェクト配列
function bulletItems(arr, extra = {}) {
  return arr.map((t, i) => ({
    text: t,
    options: Object.assign({ bullet: true, breakLine: i < arr.length - 1 }, extra),
  }));
}

// 表組みを addTable ではなく矩形＋テキストで描く（XML が軽く、Google スライドでも崩れない）
function grid(s, { x, y, w, colW, rows, rowH, headFill = "2E2350", headColor = "FFFFFF",
                   zebra = ["FFFFFF", CARD_L], line = "E2E0EA", fontSize = 10, accentCol = -1, accent }) {
  const total = colW.reduce((a, b) => a + b, 0);
  const cols = colW.map((c) => (c / total) * w);
  rows.forEach((row, r) => {
    const ry = y + r * rowH;
    s.addShape("rect", {
      x, y: ry, w, h: rowH,
      fill: { color: r === 0 ? headFill : zebra[r % 2] },
      line: { color: line, width: 0.75 },
    });
    let cx = x;
    row.forEach((cellText, c) => {
      const isAcc = r > 0 && c === accentCol;
      s.addText(cellText, {
        x: cx + 0.08, y: ry, w: cols[c] - 0.16, h: rowH, margin: 0, valign: "middle",
        fontSize: r === 0 ? fontSize : fontSize - 0.5,
        bold: r === 0 || c === 1 || isAcc,
        color: r === 0 ? headColor : isAcc ? accent : c === 1 ? INK : "3B3752",
        fontFace: "Arial",
      });
      cx += cols[c];
    });
  });
}

// ノート全文は Google ドキュメント側に集約。スライドには1行の要約だけを置く。
PptxGenJS.prototype.__noop = 0;
function shortNote(s, text) {
  // 発表用の全文台本（5分の時間配分つき）は Google ドキュメント側に集約。
  // スライドにノートを持たせないことで pptx を軽量に保つ。
  void s; void text;
}

const nowShadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 2, angle: 90, opacity: 0.18 });

function slideTitle(s, kicker, title, opts = {}) {
  const dark = !!opts.dark;
  s.addText(kicker, {
    x: M, y: 0.42, w: CW, h: 0.28, fontSize: 11, bold: true, charSpacing: 2,
    color: opts.accent || DECK, fontFace: "Arial", margin: 0,
  });
  s.addText(title, {
    x: M, y: 0.72, w: CW, h: 0.62, fontSize: 27, bold: true,
    color: dark ? LIGHT : INK, fontFace: "Arial", margin: 0,
  });
}

function badge(s, n, accent, x, y, d) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: accent }, line: { color: accent } });
  s.addText(String(n).padStart(2, "0"), {
    x, y, w: d, h: d, align: "center", valign: "middle",
    fontSize: 20, bold: true, color: "FFFFFF", fontFace: "Arial", margin: 0,
  });
}

function statCards(s, stats, { x, y, w, h, fill, big, label, accent }) {
  const gap = 0.22;
  const cw = (w - gap * (stats.length - 1)) / stats.length;
  stats.forEach((st, i) => {
    const cx = x + i * (cw + gap);
    s.addShape("roundRect", {
      x: cx, y, w: cw, h, rectRadius: 0.08,
      fill: { color: fill }, line: { type: "none" }, shadow: nowShadow(),
    });
    s.addText(st.big, {
      x: cx + 0.16, y: y + 0.14, w: cw - 0.32, h: 0.6, margin: 0,
      fontSize: 25, bold: true, color: accent, fontFace: "Arial", valign: "middle",
    });
    s.addText(st.label, {
      x: cx + 0.16, y: y + 0.74, w: cw - 0.32, h: h - 0.86, margin: 0,
      fontSize: 9.5, color: label, fontFace: "Arial", valign: "top",
    });
  });
}

// アイコン風の丸番号＋見出し＋本文 の行（見出しと本文は1ボックスに統合）
function iconRow(s, { x, y, w, n, h: head, b, accent, headColor, bodyColor, rowH }) {
  const d = 0.34;
  s.addShape("ellipse", { x, y: y + 0.03, w: d, h: d, fill: { color: accent }, line: { type: "none" } });
  s.addText(String(n), {
    x, y: y + 0.03, w: d, h: d, align: "center", valign: "middle",
    fontSize: 12, bold: true, color: "FFFFFF", fontFace: "Arial", margin: 0,
  });
  s.addText([
    { text: head, options: { fontSize: 13, bold: true, color: headColor, breakLine: true } },
    { text: b, options: { fontSize: 10.5, color: bodyColor } },
  ], {
    x: x + d + 0.16, y, w: w - d - 0.16, h: rowH || 0.9, margin: 0,
    fontFace: "Arial", lineSpacingMultiple: 1.15, valign: "top",
  });
}

// ── 生成 ────────────────────────────────────────────────────────────────────
const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.author = MEETING.division + " " + MEETING.presenter;
pres.title = MEETING.title;
pres.subject = MEETING.org + " " + MEETING.subtitle;

// ═══ 1. 表紙 ══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addShape("ellipse", { x: 9.2, y: -1.9, w: 6.2, h: 6.2, fill: { color: "2A1F4D" }, line: { type: "none" } });
  s.addShape("ellipse", { x: 11.0, y: 4.4, w: 3.4, h: 3.4, fill: { color: DECK, transparency: 78 }, line: { type: "none" } });

  s.addText(MEETING.org + "　｜　" + MEETING.subtitle, {
    x: M, y: 1.35, w: 9.4, h: 0.32, fontSize: 12, bold: true, charSpacing: 2, color: DECK, fontFace: "Arial", margin: 0,
  });
  s.addText(MEETING.title, {
    x: M, y: 1.78, w: 9.6, h: 1.5, fontSize: 46, bold: true, color: LIGHT, fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.05,
  });
  s.addText("最近見つけた新人アーティスト 3組　—　いずれもレーベル未所属、契約が狙える段階です。", {
    x: M, y: 3.32, w: 9.8, h: 0.5, fontSize: 15, color: MUTE_D, fontFace: "Arial", margin: 0,
  });

  const rows = [
    ["開催日", MEETING.date],
    ["部門 ／ 発表者", MEETING.division + "　／　" + MEETING.presenter],
    ["形式", MEETING.format],
    ["数値基準日", MEETING.asOf + " 時点の実地取得"],
  ];
  rows.forEach((r, i) => {
    const y = 4.35 + i * 0.44;
    s.addText(r[0], { x: M, y, w: 2.3, h: 0.36, fontSize: 11, color: MUTE_D, fontFace: "Arial", margin: 0, valign: "middle" });
    s.addText(r[1], { x: M + 2.3, y, w: 6.6, h: 0.36, fontSize: 11.5, bold: true, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle" });
  });

  ARTISTS.forEach((a, i) => {
    const y = 1.9 + i * 0.86;
    s.addShape("roundRect", { x: 10.05, y, w: 2.65, h: 0.72, rectRadius: 0.12, fill: { color: CARD_D }, line: { type: "none" } });
    const p = pic(a.name, "portrait");
    if (p) {
      s.addImage({ path: p.path, x: 10.19, y: y + 0.09, w: 0.54, h: 0.54, rounding: true,
                   sizing: { type: "cover", w: 0.54, h: 0.54 } });
    } else {
      s.addShape("ellipse", { x: 10.19, y: y + 0.09, w: 0.54, h: 0.54, fill: { color: a.accent }, line: { type: "none" } });
    }
    s.addText(a.name, { x: 10.85, y, w: 1.72, h: 0.72, fontSize: 11.5, bold: true, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle" });
  });

  shortNote(s, `${MEETING.date} 新人プレゼン。部門 ${MEETING.division}／発表者 ${MEETING.presenter}。全3組、1組5分。数値は ${MEETING.asOf} 時点で TikTok / YouTube / Spotify から実地取得。3組すべてレーベル未所属。`);
}

// ═══ 2. サマリー ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  slideTitle(s, "SUMMARY", "3組の位置づけ — 詰まっている場所が全部違う");

  grid(s, {
    x: M, y: 1.6, w: CW, rowH: 0.52,
    colW: [0.55, 2.3, 1.85, 2.6, 3.0, 1.8],
    accentCol: -1,
    rows: [["No", "アーティスト", "区分", "主要フォロワー", "最大到達 ／ DSP", "ステータス"],
           ...SUMMARY_ROWS.map((r) => r.slice(0, 6))],
    fontSize: 10.5,
  });

  s.addText("一言で言うと", { x: M, y: 4.42, w: CW, h: 0.3, fontSize: 13, bold: true, color: INK, fontFace: "Arial", margin: 0 });
  const n = ARTISTS.length;
  ARTISTS.forEach((a, i) => {
    const cw = (CW - 0.22 * (n - 1)) / n;
    const x = M + i * (cw + 0.22);
    s.addShape("roundRect", { x, y: 4.44, w: cw, h: 2.3, rectRadius: 0.08, fill: { color: CARD_L }, line: { type: "none" }, shadow: nowShadow() });
    const p = pic(a.name, "portrait");
    if (p) {
      s.addImage({ path: p.path, x: x + 0.2, y: 4.64, w: 0.62, h: 0.62, rounding: true,
                   sizing: { type: "cover", w: 0.62, h: 0.62 } });
    } else {
      s.addShape("ellipse", { x: x + 0.2, y: 4.64, w: 0.62, h: 0.62, fill: { color: a.accent }, line: { type: "none" } });
    }
    s.addText(a.name, { x: x + 0.94, y: 4.64, w: cw - 1.14, h: 0.62, fontSize: 13.5, bold: true, color: INK, fontFace: "Arial", margin: 0, valign: "middle" });
    s.addText(SUMMARY_ROWS[i][6], { x: x + 0.2, y: 5.42, w: cw - 0.4, h: 0.62, fontSize: 12, bold: true, color: a.accent, fontFace: "Arial", margin: 0 });
    s.addText(brief(a.status, 46), { x: x + 0.2, y: 6.08, w: cw - 0.4, h: 0.56, fontSize: 10, color: MUTE_L, fontFace: "Arial", margin: 0 });
  });

  shortNote(s, "3組すべて未所属。Vivanz Eden＝実需はあるが供給が追いつかない。Ryudai＝到達力は完成、音楽資産ゼロ。yuuna＝ER約22%で出せば必ず聴かれる。動く順番は Vivanz Eden ＞ yuuna ＞ Ryudai。");
}

// ═══ 各アーティスト（4枚組） ═══════════════════════════════════════════════
ARTISTS.forEach((a) => {
  // ── A: 表題（濃） ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: DARK };
    s.addShape("ellipse", { x: 10.6, y: -1.6, w: 5.0, h: 5.0, fill: { color: a.accent, transparency: 86 }, line: { type: "none" } });

    badge(s, a.no, a.accent, M, 0.5, 0.86);
    s.addText(a.name, { x: M + 1.1, y: 0.46, w: 7.2, h: 0.62, fontSize: 34, bold: true, color: LIGHT, fontFace: "Arial", margin: 0 });
    s.addText(a.reading + "　｜　" + a.tag, { x: M + 1.1, y: 1.08, w: 8.0, h: 0.3, fontSize: 11.5, color: MUTE_D, fontFace: "Arial", margin: 0 });

    s.addShape("roundRect", { x: 9.05, y: 0.56, w: 3.65, h: 0.76, rectRadius: 0.1, fill: { color: CARD_D }, line: { type: "none" } });
    s.addText("契約ステータス", { x: 9.25, y: 0.62, w: 3.3, h: 0.24, fontSize: 8.5, color: MUTE_D, fontFace: "Arial", margin: 0 });
    s.addText(a.status, { x: 9.25, y: 0.86, w: 3.3, h: 0.42, fontSize: 10, bold: true, color: LIGHT, fontFace: "Arial", margin: 0 });

    const port = pic(a.name, "portrait");
    const voc = pic(a.name, "vocalist");
    const TW = port ? 8.75 : CW;   // ポートレートを置く分だけ本文を詰める
    if (port) {
      s.addShape("roundRect", { x: 9.52, y: 1.74, w: 3.26, h: 3.32, rectRadius: 0.06,
                                fill: { color: CARD_D }, line: { type: "none" }, shadow: nowShadow() });
      s.addImage({ path: port.path, x: 9.6, y: 1.82, w: 3.1, h: voc ? 2.28 : 3.16,
                   sizing: { type: "cover", w: 3.1, h: voc ? 2.28 : 3.16 } });
      if (voc) {
        s.addImage({ path: voc.path, x: 9.6, y: 4.16, w: 0.98, h: 0.82,
                     sizing: { type: "cover", w: 0.98, h: 0.82 } });
        s.addText("Vo・Gt 菊地諒真", { x: 10.68, y: 4.16, w: 2.0, h: 0.82, fontSize: 9.5, bold: true,
                                      color: "C7C3DA", fontFace: "Arial", margin: 0, valign: "middle" });
      }
    }
    s.addText(a.catch, { x: M, y: 1.8, w: TW, h: 1.0, fontSize: 24, bold: true, color: a.accent, fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.15 });
    s.addText(a.catchSub, { x: M, y: 2.88, w: TW, h: 0.38, fontSize: 12.5, italic: true, color: "DCD9E8", fontFace: "Arial", margin: 0 });
    s.addText(a.oneLine, { x: M, y: 3.32, w: TW, h: 1.32, fontSize: 12, color: "C7C3DA", fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.3 });
    if (a.note) {
      s.addText(a.note, { x: M, y: 4.66, w: TW, h: 0.42, fontSize: 9, bold: true, color: "FF8FA3", fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.15 });
    }

    statCards(s, a.stats, { x: M, y: 5.18, w: CW, h: 1.6, fill: CARD_D, label: MUTE_D, accent: a.accent });

    shortNote(s, `【${a.name}】キャッチ：${a.catch}／${a.catchSub}\n\n概要：${a.oneLine}\n\nステータス：${a.status}${a.note ? "\n\n" + a.note : ""}`);
  }

  // ── B: SNS数値 ＋ 音楽性 ────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: LIGHT };
    slideTitle(s, a.name.toUpperCase() + " — 01", "フォロワー実数と音楽性", { accent: a.accent });

    const tw = 5.5;
    grid(s, {
      x: M, y: 1.62, w: tw, rowH: 0.44, colW: [1.15, 2.6, 1.75],
      rows: [["媒体", "アカウント", "規模"], ...a.sns.map((sn) => [sn.platform, sn.handle, sn.metric])],
      fontSize: 10, accentCol: 2, accent: a.accent,
    });

    // 主要指標を再掲（小）
    s.addShape("roundRect", { x: M, y: 1.62 + 0.44 * (a.sns.length + 1) + 0.28, w: tw, h: 1.5, rectRadius: 0.08, fill: { color: CARD_L }, line: { type: "none" } });
    s.addText("この規模で注目すべき数字", {
      x: M + 0.18, y: 1.62 + 0.44 * (a.sns.length + 1) + 0.42, w: tw - 0.36, h: 0.26,
      fontSize: 10, bold: true, color: MUTE_L, fontFace: "Arial", margin: 0,
    });
    s.addText(
      bulletItems(a.stats.map((st) => `${st.big}　${st.label}`)),
      {
        x: M + 0.18, y: 1.62 + 0.44 * (a.sns.length + 1) + 0.7, w: tw - 0.36, h: 0.72,
        fontSize: 9.5, color: INK, fontFace: "Arial", margin: 0, paraSpaceAfter: 3,
      }
    );

    const rx = M + tw + 0.5;
    const rw = CW - tw - 0.5;
    s.addText("音楽性", { x: rx, y: 1.62, w: rw, h: 0.3, fontSize: 14, bold: true, color: INK, fontFace: "Arial", margin: 0 });
    a.music.forEach((m, i) => {
      const y = 2.02 + i * 1.12;
      s.addShape("roundRect", { x: rx, y, w: rw, h: 1.0, rectRadius: 0.07, fill: { color: CARD_L }, line: { type: "none" } });
      s.addShape("ellipse", { x: rx + 0.16, y: y + 0.16, w: 0.26, h: 0.26, fill: { color: a.accent }, line: { type: "none" } });
      s.addText(String(i + 1), { x: rx + 0.16, y: y + 0.16, w: 0.26, h: 0.26, align: "center", valign: "middle", fontSize: 10, bold: true, color: "FFFFFF", fontFace: "Arial", margin: 0 });
      s.addText(brief(m, 118), { x: rx + 0.5, y: y + 0.12, w: rw - 0.68, h: 0.78, fontSize: 10.5, color: "2C2842", fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.2 });
    });

    shortNote(s, `【${a.name}｜フォロワーと音楽性】\n` +
      a.sns.map((sn) => `・${sn.platform} ${sn.handle}：${sn.metric}（${sn.sub}）`).join("\n") +
      "\n\n音楽性（全文）\n" + a.music.map((m, i) => `${i + 1}) ${m}`).join("\n"));
  }

  // ── C: 魅力 ＋ 詰まり ──────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: LIGHT };
    slideTitle(s, a.name.toUpperCase() + " — 02", "何が魅力なのか", { accent: a.accent });

    const items = a.strengths.slice(0, 4);
    const gap = 0.24;
    const cw = (CW - gap) / 2;
    const ch = 1.42;
    items.forEach((st, i) => {
      const x = M + (i % 2) * (cw + gap);
      const y = 1.6 + Math.floor(i / 2) * (ch + gap);
      s.addShape("roundRect", { x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: CARD_L }, line: { type: "none" }, shadow: nowShadow() });
      iconRow(s, {
        x: x + 0.2, y: y + 0.18, w: cw - 0.4, n: i + 1, h: st.h, b: brief(st.b, 118),
        accent: a.accent, headColor: INK, bodyColor: "3B3752", rowH: ch - 0.34,
      });
    });

    const gy = 1.6 + 2 * (ch + gap) + 0.14;
    s.addShape("roundRect", { x: M, y: gy, w: CW, h: 1.62, rectRadius: 0.08, fill: { color: "2E2350" }, line: { type: "none" }, shadow: nowShadow() });
    s.addText(a.gap.title, { x: M + 0.28, y: gy + 0.18, w: CW - 0.56, h: 0.3, fontSize: 13, bold: true, color: a.accent, fontFace: "Arial", margin: 0 });
    s.addText(a.gap.body, { x: M + 0.28, y: gy + 0.52, w: CW - 0.56, h: 0.95, fontSize: 11.5, color: "E4E2EE", fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.25 });

    shortNote(s, `【${a.name}｜魅力（全文）】\n` + a.strengths.map((x, i) => `${i + 1}) ${x.h}：${x.b}`).join("\n") +
      `\n\n【詰まり】${a.gap.title}\n${a.gap.body}`);
  }

  // ── D: 打ち手 ＋ 参考動画 ──────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: LIGHT };
    slideTitle(s, a.name.toUpperCase() + " — 03", "ヒットへの手がかり ／ 参考動画", { accent: a.accent });

    const lw = 7.05;
    s.addText("レーベルは何をしたら売れるか", { x: M, y: 1.6, w: lw, h: 0.3, fontSize: 13.5, bold: true, color: INK, fontFace: "Arial", margin: 0 });
    a.playbook.slice(0, 5).forEach((pb, i) => {
      const y = 2.0 + i * 0.98;
      iconRow(s, {
        x: M, y, w: lw, n: i + 1, h: pb.h, b: brief(pb.b, 96),
        accent: a.accent, headColor: INK, bodyColor: "3B3752", rowH: 0.9,
      });
    });

    const rx = M + lw + 0.4;
    const rw = CW - lw - 0.4;
    s.addText("おすすめ参考動画", { x: rx, y: 1.6, w: rw, h: 0.3, fontSize: 13.5, bold: true, color: INK, fontFace: "Arial", margin: 0 });
    a.refs.slice(0, 4).forEach((r, i) => {
      const y = 2.0 + i * 1.24;
      s.addShape("roundRect", { x: rx, y, w: rw, h: 1.12, rectRadius: 0.07, fill: { color: CARD_L }, line: { type: "none" } });
      const th = refPic(a.name, i);
      const tx = th ? 1.42 : 0;   // サムネイル分のインデント
      if (th) {
        s.addImage({ path: th.path, x: rx + 0.1, y: y + 0.1, w: 1.24, h: 0.92,
                     sizing: { type: "cover", w: 1.24, h: 0.92 },
                     hyperlink: { url: r.url, tooltip: r.url } });
      }
      s.addText([
        { text: r.label, options: { fontSize: 9.5, bold: true, color: INK, breakLine: true } },
        { text: "→ " + brief(r.why, 40), options: { fontSize: 8, italic: true, color: MUTE_L } },
      ], { x: rx + 0.14 + tx, y: y + 0.09, w: rw - 0.28 - tx, h: 0.8, margin: 0, fontFace: "Arial", lineSpacingMultiple: 1.1, valign: "top" });
      s.addText("▶ 動画を開く", {
        x: rx + 0.14 + tx, y: y + 0.87, w: rw - 0.28 - tx, h: 0.2, fontSize: 8, bold: true, color: "1155CC",
        fontFace: "Arial", margin: 0, hyperlink: { url: r.url, tooltip: r.url },
      });
    });

    s.addText("留意点：" + a.risks, { x: M, y: 6.86, w: CW, h: 0.42, fontSize: 9, color: MUTE_L, fontFace: "Arial", margin: 0 });

    shortNote(s, `【${a.name}｜打ち手（全文）】\n` + a.playbook.map((x, i) => `${i + 1}) ${x.h}：${x.b}`).join("\n") +
      "\n\n【参考動画】\n" + a.refs.map((r) => `・${r.label}\n  ${r.url}\n  → ${r.why}`).join("\n") +
      `\n\n【留意点】${a.risks}`);
  }
});

// ═══ ダンサー2組の方向性整理 ═══════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  slideTitle(s, "CATEGORY NOTE", "Ryudai と yuuna — 別々にご紹介しましたが、同じ方向です");

  const pair = [ARTISTS[1], ARTISTS[2]];
  const gap = 0.3;
  const cw = (CW - gap) / 2;
  pair.forEach((a, i) => {
    const x = M + i * (cw + gap);
    s.addShape("roundRect", { x, y: 1.62, w: cw, h: 2.5, rectRadius: 0.09, fill: { color: CARD_L }, line: { type: "none" }, shadow: nowShadow() });
    s.addShape("ellipse", { x: x + 0.24, y: 1.84, w: 0.36, h: 0.36, fill: { color: a.accent }, line: { type: "none" } });
    s.addText(a.name, { x: x + 0.72, y: 1.82, w: cw - 0.96, h: 0.4, fontSize: 17, bold: true, color: INK, fontFace: "Arial", margin: 0, valign: "middle" });
    const facts = [
      `TikTok ${a.stats[0].big}フォロワー`,
      `最大再生 ${a.name === "Ryudai" ? "5,430万" : "260万"}`,
      a.name === "Ryudai" ? "iCON Z（LDH）男性部門2次審査合格" : "K-POP練習生経験あり／大阪拠点",
      a.name === "Ryudai" ? "日韓ハーフ・振付／ダンス講師" : "Instagram 46.2万・ビジュアル資産",
    ];
    s.addText(bulletItems(facts), {
      x: x + 0.26, y: 2.34, w: cw - 0.52, h: 1.6, fontSize: 11, color: "2C2842",
      fontFace: "Arial", margin: 0, paraSpaceAfter: 6,
    });
  });

  const shared = [
    { h: "共通点", b: "TikTokを主戦場とする男性ダンサー／レーベル未所属／音源リリースなし／使用音源が海外トラック中心でグローバルにオーガニックなリーチを持つ／K-POPフォーマットとの適性。" },
    { h: "違い", b: "Ryudai は到達力（1本5,430万）と海外アーティスト共演の実績。yuuna はエンゲージ率（約22%）とビジュアル資産。攻め方が違うため、企画も分けて設計します。" },
    { h: "扱い方の前提", b: "共演実績はありますが、契約はあくまで個別で進める前提です。ユニット企画は本人確認を取った上での別案として置きます。" },
  ];
  shared.forEach((r, i) => {
    const y = 4.4 + i * 0.85;
    iconRow(s, { x: M, y, w: CW, n: i + 1, h: r.h, b: r.b, accent: DECK, headColor: INK, bodyColor: "3B3752", rowH: 0.8 });
  });

  shortNote(s, "2組をまとめずに個別紹介した理由と、それでも方向性が同じであることの整理。共通点＝TikTok主戦場の男性ダンサー、未所属、音源なし、海外音源での回転、K-POP適性。違い＝Ryudaiは到達力、yuunaはエンゲージ率とビジュアル。契約は個別前提。");
}

// ═══ 追加候補枠 ════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  slideTitle(s, "PIPELINE", PENDING.title);

  s.addShape("roundRect", { x: M, y: 1.62, w: CW, h: 1.15, rectRadius: 0.08, fill: { color: CARD_L }, line: { type: "none" } });
  s.addText(PENDING.body, { x: M + 0.28, y: 1.78, w: CW - 0.56, h: 0.85, fontSize: 12, color: "2C2842", fontFace: "Arial", margin: 0, lineSpacingMultiple: 1.25 });

  s.addText("スクリーニング基準", { x: M, y: 3.05, w: CW, h: 0.3, fontSize: 13.5, bold: true, color: INK, fontFace: "Arial", margin: 0 });
  const gap = 0.24;
  const cw = (CW - gap) / 2;
  PENDING.criteria.forEach((c, i) => {
    const x = M + (i % 2) * (cw + gap);
    const y = 3.48 + Math.floor(i / 2) * 1.0;
    s.addShape("roundRect", { x, y, w: cw, h: 0.84, rectRadius: 0.07, fill: { color: "FFFFFF" }, line: { color: "E2E0EA", width: 1 } });
    s.addShape("ellipse", { x: x + 0.18, y: y + 0.26, w: 0.28, h: 0.28, fill: { color: DECK }, line: { type: "none" } });
    s.addText(String(i + 1), { x: x + 0.18, y: y + 0.26, w: 0.28, h: 0.28, align: "center", valign: "middle", fontSize: 11, bold: true, color: "FFFFFF", fontFace: "Arial", margin: 0 });
    s.addText(c, { x: x + 0.56, y: y + 0.14, w: cw - 0.74, h: 0.6, fontSize: 11, color: "2C2842", fontFace: "Arial", margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
  });

  s.addShape("roundRect", { x: M, y: 5.62, w: CW, h: 1.1, rectRadius: 0.08, fill: { color: "2E2350" }, line: { type: "none" } });
  s.addText("この枠は本資料に追記します", { x: M + 0.28, y: 5.76, w: CW - 0.56, h: 0.3, fontSize: 12, bold: true, color: DECK, fontFace: "Arial", margin: 0 });
  s.addText("候補が固まり次第、同じフォーマット（表題／数値／音楽性／魅力／打ち手／参考動画）でスライドを追加し、Googleドキュメント側にも同じ内容を反映します。", {
    x: M + 0.28, y: 6.08, w: CW - 0.56, h: 0.55, fontSize: 11, color: "D9D6E6", fontFace: "Arial", margin: 0,
  });

  shortNote(s, "Ryudai / yuuna と同系統の候補を継続調査中。基準は TikTok 30万以上・ER10%以上・未所属・ボーカル適性・海外音源中心。固まり次第この資料に追記する。");
}

// ═══ まとめ ／ アスク ══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addShape("ellipse", { x: -1.8, y: 4.6, w: 5.4, h: 5.4, fill: { color: "2A1F4D" }, line: { type: "none" } });
  slideTitle(s, "CLOSING", "本日のアスク — 3組それぞれ、次の一手", { dark: true });

  CLOSING.asks.forEach((x, i) => {
    const y = 1.62 + i * 1.02;
    const acc = ARTISTS[i].accent;
    s.addShape("roundRect", { x: M, y, w: CW, h: 0.9, rectRadius: 0.08, fill: { color: CARD_D }, line: { type: "none" } });
    s.addShape("ellipse", { x: M + 0.2, y: y + 0.28, w: 0.34, h: 0.34, fill: { color: acc }, line: { type: "none" } });
    s.addText(String(i + 1), { x: M + 0.2, y: y + 0.28, w: 0.34, h: 0.34, align: "center", valign: "middle", fontSize: 12, bold: true, color: "FFFFFF", fontFace: "Arial", margin: 0 });
    s.addText(x.h, { x: M + 0.66, y: y + 0.12, w: 2.9, h: 0.66, fontSize: 13, bold: true, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle" });
    s.addText(x.b, { x: M + 3.6, y: y + 0.12, w: CW - 3.85, h: 0.66, fontSize: 10.5, color: "C7C3DA", fontFace: "Arial", margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
  });

  s.addShape("roundRect", { x: M, y: 5.86, w: CW, h: 0.82, rectRadius: 0.08, fill: { color: DECK, transparency: 82 }, line: { color: DECK, width: 1 } });
  s.addText("動く順番", { x: M + 0.24, y: 5.96, w: 1.5, h: 0.28, fontSize: 11, bold: true, color: DECK, fontFace: "Arial", margin: 0 });
  s.addText(CLOSING.priority, { x: M + 1.7, y: 5.94, w: CW - 1.95, h: 0.64, fontSize: 10.5, color: "EDEBF4", fontFace: "Arial", margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });

  s.addText(CLOSING.note, { x: M, y: 6.92, w: CW, h: 0.36, fontSize: 8.5, color: "8B87A3", fontFace: "Arial", margin: 0 });

  shortNote(s, "アスク（全文）\n" + CLOSING.asks.map((x) => `・${x.h}：${x.b}`).join("\n") + "\n\n優先度：" + CLOSING.priority + "\n\n" + CLOSING.note);
}

pres.writeFile({ fileName: "新人プレゼン資料_2026-07-27.pptx" }).then((f) =>
  console.log("wrote", f, "/ slides:", pres.slides ? pres.slides.length : "?")
);
