// Google ドキュメント用 .docx を生成（Drive アップロード時に Google Docs へ変換）
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, LevelFormat, ExternalHyperlink, TableOfContents,
} = require("docx");
const { MEETING, ARTISTS, PENDING, SUMMARY_ROWS, CLOSING } = require("./data.js");

const CW = 9700;               // content width (DXA)
const INK = "1A1A1A";
const MUTE = "5F6368";
const RULE = "D6D8DC";
const HEADFILL = "F1F3F5";

// ── helpers ────────────────────────────────────────────────────────────────
const p = (text, o = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 120 },
    indent: o.indent,
    border: o.rule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } } : undefined,
    children: [new TextRun({
      text, bold: o.bold, italics: o.italics, size: o.size ?? 21,
      color: o.color ?? INK, font: o.font,
    })],
  });

// A paragraph made of mixed runs: [{t, bold, color, size, italics}]
const rich = (runs, o = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 120 },
    indent: o.indent,
    children: runs.map((r) => new TextRun({
      text: r.t, bold: r.bold, italics: r.italics,
      size: r.size ?? o.size ?? 21, color: r.color ?? o.color ?? INK,
    })),
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: "dot", level },
    spacing: { after: 90 },
    children: [new TextRun({ text, size: 21, color: INK })],
  });

// "見出し: 本文" 形式の箇条書き
const bulletHB = (h, b, level = 0) =>
  new Paragraph({
    numbering: { reference: "dot", level },
    spacing: { after: 110 },
    children: [
      new TextRun({ text: h + "　", bold: true, size: 21, color: INK }),
      new TextRun({ text: b, size: 21, color: INK }),
    ],
  });

const linkBullet = (label, url, why) =>
  new Paragraph({
    numbering: { reference: "dot", level: 0 },
    spacing: { after: 110 },
    children: [
      new TextRun({ text: label, size: 21, color: INK }),
      new TextRun({ text: "　", size: 21 }),
      new ExternalHyperlink({
        children: [new TextRun({ text: url, size: 19, color: "1155CC", underline: {} })],
        link: url,
      }),
      ...(why ? [new TextRun({ text: "　→ " + why, size: 19, color: MUTE, italics: true })] : []),
    ],
  });

const cell = (text, o = {}) =>
  new TableCell({
    width: { size: o.w, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: (Array.isArray(text) ? text : [text]).map((t) =>
      new Paragraph({
        spacing: { after: 0 },
        children: [new TextRun({ text: t, bold: o.bold, size: o.size ?? 19, color: o.color ?? INK })],
      })),
  });

const table = (widths, rows) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    },
    rows,
  });

const h1 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 320, after: 160 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: INK })],
});
const h2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 110 },
  children: [new TextRun({ text: t, bold: true, size: 23, color: INK })],
});

// ── 本文構築 ────────────────────────────────────────────────────────────────
const body = [];

// 表紙相当
body.push(p(MEETING.org + "　" + MEETING.subtitle, { size: 19, color: MUTE, after: 60 }));
body.push(p(MEETING.title, { bold: true, size: 44, after: 100 }));
body.push(p("最近見つけた新人アーティスト 4組のご紹介", { size: 24, color: MUTE, after: 200, rule: true }));
body.push(table([2400, 7300], [
  new TableRow({ children: [cell("開催日", { w: 2400, bold: true, fill: HEADFILL }), cell(MEETING.date, { w: 7300 })] }),
  new TableRow({ children: [cell("部門 ／ 発表者", { w: 2400, bold: true, fill: HEADFILL }), cell(MEETING.division + "　／　" + MEETING.presenter, { w: 7300 })] }),
  new TableRow({ children: [cell("提案件数", { w: 2400, bold: true, fill: HEADFILL }), cell(MEETING.countLabel, { w: 7300 })] }),
  new TableRow({ children: [cell("形式", { w: 2400, bold: true, fill: HEADFILL }), cell(MEETING.format, { w: 7300 })] }),
  new TableRow({ children: [cell("数値基準日", { w: 2400, bold: true, fill: HEADFILL }), cell(MEETING.asOf + " 時点の公開情報を実地取得", { w: 7300 })] }),
]));
body.push(p("", { after: 200 }));

// 目次
body.push(h2("目次"));
body.push(new TableOfContents("目次", { hyperlink: true, headingStyleRange: "1-2" }));
body.push(new Paragraph({ children: [new PageBreak()] }));

// サマリー
body.push(h1("0. サマリー — 4組の位置づけ"));
body.push(p("全組ともレーベル未所属。フォロワー規模ではなく「詰まっている場所」が組ごとに違うため、レーベルの打ち手も分けて設計しています。", { after: 160 }));
const sumW = [520, 1900, 1500, 1900, 2080, 1800];
body.push(table(sumW, [
  new TableRow({
    tableHeader: true,
    children: ["No", "アーティスト", "区分", "主要フォロワー", "最大到達 ／ DSP", "契約ステータス"]
      .map((t, i) => cell(t, { w: sumW[i], bold: true, fill: HEADFILL })),
  }),
  ...SUMMARY_ROWS.map((r) => new TableRow({
    children: [r[0], r[1], r[2], r[3], r[4], r[5]].map((t, i) => cell(t, { w: sumW[i] })),
  })),
]));
body.push(p("", { after: 120 }));
body.push(h2("一言で言うと"));
SUMMARY_ROWS.forEach((r) => body.push(bulletHB(r[1], r[6])));
body.push(new Paragraph({ children: [new PageBreak()] }));

// 各アーティスト
ARTISTS.forEach((a, idx) => {
  body.push(h1(`${a.no}. ${a.name}　（${a.reading}）`));
  body.push(rich([{ t: a.tag, bold: true, color: MUTE, size: 20 }, { t: "　｜　", color: RULE }, { t: a.status, color: MUTE, size: 20 }], { after: 160 }));

  // キャッチコピー
  body.push(table([CW], [
    new TableRow({
      children: [new TableCell({
        width: { size: CW, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: HEADFILL, color: "auto" },
        margins: { top: 140, bottom: 140, left: 160, right: 160 },
        children: [
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "キャッチコピー", size: 17, color: MUTE, bold: true })] }),
          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "「" + a.catch + "」", bold: true, size: 28, color: INK })] }),
          new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: a.catchSub, size: 19, color: MUTE })] }),
        ],
      })],
    }),
  ]));
  body.push(p("", { after: 140 }));

  if (a.note) body.push(rich([{ t: a.note, size: 19, color: "B3261E" }], { after: 160 }));

  body.push(h2("どんなアーティストか"));
  body.push(p(a.oneLine, { after: 160 }));

  // 数値
  body.push(h2("主要指標"));
  const stW = [2425, 2425, 2425, 2425];
  body.push(table(stW, [
    new TableRow({ children: a.stats.map((s, i) => cell(s.big, { w: stW[i], bold: true, size: 30 })) }),
    new TableRow({ children: a.stats.map((s, i) => cell(s.label, { w: stW[i], size: 17, color: MUTE })) }),
  ]));
  body.push(p("", { after: 140 }));

  body.push(h2("SNS ／ プラットフォーム別フォロワー数"));
  const snsW = [1500, 2400, 2200, 3600];
  body.push(table(snsW, [
    new TableRow({
      tableHeader: true,
      children: ["媒体", "アカウント", "規模", "備考"].map((t, i) => cell(t, { w: snsW[i], bold: true, fill: HEADFILL })),
    }),
    ...a.sns.map((s) => new TableRow({
      children: [
        cell(s.platform, { w: snsW[0], bold: true }),
        cell(s.handle, { w: snsW[1] }),
        cell(s.metric, { w: snsW[2], bold: true }),
        cell(s.sub, { w: snsW[3], size: 17, color: MUTE }),
      ],
    })),
  ]));
  body.push(p("", { after: 160 }));

  body.push(h2("音楽性"));
  a.music.forEach((m) => body.push(bullet(m)));

  body.push(h2("何が魅力なのか"));
  a.strengths.forEach((s) => body.push(bulletHB(s.h, s.b)));

  body.push(h2(a.gap.title));
  body.push(p(a.gap.body, { after: 160 }));

  body.push(h2("ヒットへの手がかり — レーベルは何をしたら売れるか"));
  a.playbook.forEach((s, i) => body.push(bulletHB(`${i + 1}）${s.h}`, s.b)));

  body.push(h2("おすすめ参考動画"));
  a.refs.forEach((r) => body.push(linkBullet(r.label, r.url, r.why)));

  body.push(h2("留意点 ／ 確認事項"));
  body.push(p(a.risks, { after: 160 }));

  // 5分トーク
  body.push(h2("5分プレゼンの進め方（目安）"));
  const tkW = [1500, 8200];
  body.push(table(tkW, [
    new TableRow({
      tableHeader: true,
      children: ["時間", "話すこと"].map((t, i) => cell(t, { w: tkW[i], bold: true, fill: HEADFILL })),
    }),
    new TableRow({ children: [cell("0:00–0:30", { w: tkW[0], bold: true }), cell(`キャッチコピー「${a.catch}」から入る。${a.catchSub}`, { w: tkW[1] })] }),
    new TableRow({ children: [cell("0:30–1:30", { w: tkW[0], bold: true }), cell("何者か＋主要指標4つ（" + a.stats.map((s) => `${s.big}=${s.label}`).join(" / ") + "）", { w: tkW[1] })] }),
    new TableRow({ children: [cell("1:30–2:30", { w: tkW[0], bold: true }), cell("参考動画①を再生：" + a.refs[0].label, { w: tkW[1] })] }),
    new TableRow({ children: [cell("2:30–3:30", { w: tkW[0], bold: true }), cell("魅力の1点目と2点目に絞って話す：" + a.strengths[0].h + " ／ " + a.strengths[1].h, { w: tkW[1] })] }),
    new TableRow({ children: [cell("3:30–4:30", { w: tkW[0], bold: true }), cell("詰まりと打ち手：" + a.gap.title + " → " + a.playbook.slice(0, 2).map((x) => x.h).join(" ／ "), { w: tkW[1] })] }),
    new TableRow({ children: [cell("4:30–5:00", { w: tkW[0], bold: true }), cell("アスク：" + (CLOSING.asks.find((x) => a.name.startsWith(x.h.split("（")[0]))?.b || "次アクションの合意を取る。"), { w: tkW[1] })] }),
  ]));

  if (idx === 1) {
    body.push(p("", { after: 120 }));
    body.push(rich([
      { t: "▸ 補足：", bold: true },
      { t: "Ryudai と次の yuuna は別々にご紹介しますが、方向性は同系統です（TikTok を主戦場とする男性ダンサー／K-POPフォーマット適性／レーベル未所属／海外音源での回転）。共演実績もあるため、個別の契約を前提に、ユニット企画は別途の可能性として置いています。" },
    ], { after: 120, color: MUTE, size: 19 }));
  }

  body.push(new Paragraph({ children: [new PageBreak()] }));
});

// 追加候補
body.push(h1("5. " + PENDING.title));
body.push(p(PENDING.body, { after: 140 }));
body.push(h2("追加候補のスクリーニング基準"));
PENDING.criteria.forEach((c) => body.push(bullet(c)));
body.push(h2("追記用フォーマット"));
const pdW = [1600, 2400, 2400, 3300];
body.push(table(pdW, [
  new TableRow({ tableHeader: true, children: ["項目", "内容", "項目", "内容"].map((t, i) => cell(t, { w: pdW[i], bold: true, fill: HEADFILL })) }),
  ...[["アーティスト名", "", "区分", ""], ["TikTok", "", "Instagram", ""], ["YouTube", "", "DSP", ""], ["キャッチコピー", "", "契約ステータス", ""], ["音楽性", "", "参考動画", ""]]
    .map((r) => new TableRow({ children: r.map((t, i) => cell(t, { w: pdW[i], bold: i % 2 === 0, fill: i % 2 === 0 ? HEADFILL : undefined })) })),
]));
body.push(new Paragraph({ children: [new PageBreak()] }));

// クロージング
body.push(h1("6. まとめ ／ 本日のアスク"));
body.push(h2("組別のアスク"));
CLOSING.asks.forEach((x) => body.push(bulletHB(x.h, x.b)));
body.push(h2("動く順番"));
body.push(p(CLOSING.priority, { after: 160 }));

body.push(h2("提出シート記入用（新人プレゼン シート形式）"));
const shW = [520, 1500, 900, 2300, 2680, 1800];
body.push(table(shW, [
  new TableRow({ tableHeader: true, children: ["No", "部門", "名前", "新人アーティスト名", "URL", "備考"].map((t, i) => cell(t, { w: shW[i], bold: true, fill: HEADFILL })) }),
  ...ARTISTS.map((a) => new TableRow({
    children: [
      cell(String(a.no), { w: shW[0] }),
      cell(MEETING.division, { w: shW[1] }),
      cell(MEETING.presenter, { w: shW[2] }),
      cell(a.name === "Vivanz Eden" ? "Vivanz Eden（Vo. 菊地諒真）" : a.name, { w: shW[3] }),
      cell(a.sns[0].url, { w: shW[4], size: 15 }),
      cell(a.tag + "／" + a.status, { w: shW[5], size: 15 }),
    ],
  })),
]));
body.push(p("", { after: 160 }));
body.push(rich([{ t: "注記　", bold: true, color: MUTE, size: 18 }, { t: CLOSING.note, color: MUTE, size: 18 }]));

// ── 出力 ───────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: MEETING.division + " " + MEETING.presenter,
  title: MEETING.title,
  description: MEETING.org + " " + MEETING.subtitle,
  numbering: {
    config: [{
      reference: "dot",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 800, hanging: 260 } } } },
      ],
    }],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 21, color: INK } } },
  },
  sections: [{
    properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("新人プレゼン資料_2026-07-27.docx", buf);
  console.log("wrote 新人プレゼン資料_2026-07-27.docx", buf.length, "bytes");
});
