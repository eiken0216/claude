const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "SNS Project Team";
pres.title = "T.M.Revolution HOT LIMIT Mステ連動 SNS施策プラン";

// ---- palette (topic-informed: HOT LIMIT = 黒衣装 × 真夏 × 発熱) ----
const INK = "12131A";
const INK2 = "23252F";
const RED = "D8261C";
const AMBER = "F2A104";
const PAPER = "FFFFFF";
const TINT = "F4F3F1";
const RTINT = "FCEDEB";
const MUTED = "6E7480";
const LINE = "DFDEDB";
const F = "Noto Sans JP";

const M = 0.6;           // margin
const W = 13.33 - M * 2; // 12.13 usable

// ================= helpers =================
function head(s, kicker, title, dark) {
  const fg = dark ? PAPER : INK;
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 0.34, w: Math.max(0.85, kicker.length * 0.105 + 0.3), h: 0.28,
    fill: { color: dark ? RED : RTINT }, rectRadius: 0.14, line: { type: "none" },
  });
  s.addText(kicker, {
    x: M, y: 0.34, w: Math.max(0.85, kicker.length * 0.105 + 0.3), h: 0.28,
    fontFace: F, fontSize: 10.5, bold: true, color: dark ? PAPER : RED,
    align: "center", valign: "middle", margin: 0,
  });
  s.addText(title, {
    x: M, y: 0.72, w: W, h: 0.55, fontFace: F, fontSize: 27, bold: true,
    color: fg, align: "left", valign: "middle", margin: 0,
  });
}

function bullets(s, items, opt) {
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 14 }, breakLine: i !== items.length - 1 },
    })),
    Object.assign({
      fontFace: F, fontSize: 11.5, color: INK2, lineSpacing: 17,
      paraSpaceAfter: 7, valign: "top", margin: 0,
    }, opt)
  );
}

// a "post copy" card — the visual motif for every 文言案
function postCard(s, x, y, w, label, lines) {
  const h = 0.40 + lines.length * 0.22;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, fill: { color: TINT }, rectRadius: 0.06, line: { type: "none" },
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.16, y: y + 0.12, w: 0.62, h: 0.2,
    fill: { color: RED }, rectRadius: 0.1, line: { type: "none" },
  });
  s.addText(label, {
    x: x + 0.16, y: y + 0.12, w: 0.62, h: 0.2, fontFace: F, fontSize: 8,
    bold: true, color: PAPER, align: "center", valign: "middle", margin: 0,
  });
  s.addText(
    lines.map((t, i) => ({ text: t, options: { breakLine: i !== lines.length - 1 } })),
    {
      x: x + 0.86, y: y + 0.1, w: w - 1.02, h: h - 0.2, fontFace: F, fontSize: 10.5,
      color: INK, lineSpacing: 15.5, valign: "top", margin: 0,
    }
  );
  return h;
}

function sectionTitle(s, x, y, w, txt) {
  s.addText(txt, {
    x, y, w, h: 0.28, fontFace: F, fontSize: 13.5, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
}

function table(s, rows, opts) {
  s.addTable(rows, Object.assign({
    x: M, y: 1.5, w: W, fontFace: F, fontSize: 10, color: INK2,
    border: { type: "solid", color: LINE, pt: 0.75 },
    valign: "middle", margin: [4, 7, 4, 7], autoPage: false,
  }, opts));
}

function hdrRow(cells) {
  return cells.map((t) => ({
    text: t,
    options: { fill: { color: INK }, color: PAPER, bold: true, fontSize: 10 },
  }));
}

// ================= 1. Title =================
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.55, w: 3.3, h: 0.36, fill: { color: RED }, rectRadius: 0.18, line: { type: "none" },
  });
  s.addText("2026.07.30 ／ SNSプロジェクトチーム", {
    x: M, y: 1.55, w: 3.3, h: 0.36, fontFace: F, fontSize: 10.5, bold: true,
    color: PAPER, align: "center", valign: "middle", margin: 0,
  });
  s.addText("T.M.Revolution「HOT LIMIT」", {
    x: M, y: 2.15, w: 11.5, h: 0.85, fontFace: F, fontSize: 40, bold: true,
    color: PAPER, valign: "middle", margin: 0,
  });
  s.addText("Mステ出演連動 SNS施策プラン", {
    x: M, y: 3.0, w: 11.5, h: 0.85, fontFace: F, fontSize: 40, bold: true,
    color: AMBER, valign: "middle", margin: 0,
  });
  s.addText("対象期間：2026年7月30日(木) 〜 8月16日(日)", {
    x: M, y: 4.05, w: 11.5, h: 0.35, fontFace: F, fontSize: 14, color: "B9BCC4",
    valign: "middle", margin: 0,
  });
  const kv = [
    ["8/7(金) 21:00", "ミュージックステーション出演"],
    ["7/10", "THE FIRST TAKE 公開 → 史上最速1,000万再生"],
    ["8/7(金)", "TikTok 公式アカウント開設"],
  ];
  kv.forEach(([a, b], i) => {
    const x = M + i * 4.05;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 5.15, w: 3.85, h: 1.35, fill: { color: INK2 }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addText(a, {
      x: x + 0.22, y: 5.32, w: 3.4, h: 0.42, fontFace: F, fontSize: 17, bold: true,
      color: AMBER, valign: "middle", margin: 0,
    });
    s.addText(b, {
      x: x + 0.22, y: 5.74, w: 3.45, h: 0.62, fontFace: F, fontSize: 10.5,
      color: "D5D7DC", valign: "top", margin: 0, lineSpacing: 14,
    });
  });
}

// ================= 2. サマリー =================
{
  const s = pres.addSlide();
  head(s, "SUMMARY", "この施策のゴールと、勝ち筋3本", false);

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.5, w: W, h: 0.95, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("KGI｜Mステ放送日を「ピーク」ではなく「踊り場」にする。", {
    x: M + 0.28, y: 1.62, w: W - 0.56, h: 0.38, fontFace: F, fontSize: 16, bold: true,
    color: PAPER, valign: "middle", margin: 0,
  });
  s.addText("燃料も追い風も既に揃っている。今回の仕事は「火をつける」ことではなく、8月後半までUGCが自走するよう「消えないように薪をくべ続ける」こと。", {
    x: M + 0.28, y: 1.98, w: W - 0.56, h: 0.36, fontFace: F, fontSize: 11,
    color: "C9CCD2", valign: "middle", margin: 0,
  });

  const win = [
    ["01", "素材を配る", "TFTグリーンバック素材＝二次創作の燃料。「見るコンテンツ」から「使うコンテンツ」へ変える。お題まで指定して投稿ハードルを下げる。"],
    ["02", "本人が拾う", "西川さんのXがUGC最大の増幅装置。口パク騒動の自虐フォーマットは5万いいね超で実証済み。拾われる体験を量産する。"],
    ["03", "日を跨いで撃つ", "当日一発ではなく「前3日／当日4波／後3日」。さらにお盆（8/11〜16）を第2の山として設計する。"],
  ];
  win.forEach(([n, t, d], i) => {
    const x = M + i * 4.12;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.68, w: 3.89, h: 2.05, fill: { color: TINT }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.24, y: 2.9, w: 0.44, h: 0.44, fill: { color: RED }, line: { type: "none" },
    });
    s.addText(n, {
      x: x + 0.24, y: 2.9, w: 0.44, h: 0.44, fontFace: F, fontSize: 12, bold: true,
      color: PAPER, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: x + 0.8, y: 2.9, w: 2.9, h: 0.44, fontFace: F, fontSize: 15, bold: true,
      color: INK, valign: "middle", margin: 0,
    });
    s.addText(d, {
      x: x + 0.24, y: 3.5, w: 3.4, h: 1.1, fontFace: F, fontSize: 10.5, color: INK2,
      valign: "top", margin: 0, lineSpacing: 15,
    });
  });

  sectionTitle(s, M, 4.95, 6, "KPI（案）");
  bullets(s, [
    "#HOTLIMIT のX投稿数／インプレッション（8/7 に7月比◯倍）",
    "TikTok 楽曲使用動画数・#HOTLIMIT 再生数（8/7〜8/10 で日次最大）",
    "TikTok公式アカウント：開設72時間でのフォロワー数",
  ], { x: M, y: 5.3, w: 6.0, h: 1.6 });
  bullets(s, [
    "YouTube 週間再生（TFT／MV）＝8/7週も1位維持",
    "Billboard JAPAN Hot 100（8/12付・8/19付）の順位推移",
    "TVer 見逃し配信 再生数（8/8〜8/10）",
  ], { x: 6.9, y: 5.3, w: 5.83, h: 1.6 });
}

// ================= 3. 前提ファクト =================
{
  const s = pres.addSlide();
  head(s, "FACT", "いま起きていること：燃料も追い風も揃っている", false);

  const stats = [
    ["1,000万再生", "THE FIRST TAKE 史上最速（約4日）\n7/10公開「HOT LIMIT」"],
    ["約1.2億imp", "7/9 X予告画像＋本人の返し\n1投稿で到達"],
    ["2週連続1位", "YouTubeチャート\n週間627.1万再生"],
    ["ρ = 0.80", "再生数と気温の相関\n（2024/1〜2026/7・132週）"],
  ];
  stats.forEach(([big, sub], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.5, w: 2.86, h: 1.62, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addText(big, {
      x: x + 0.2, y: 1.66, w: 2.5, h: 0.6, fontFace: F, fontSize: 25, bold: true,
      color: AMBER, valign: "middle", margin: 0,
    });
    s.addText(sub, {
      x: x + 0.2, y: 2.28, w: 2.5, h: 0.72, fontFace: F, fontSize: 9.5, color: "C9CCD2",
      valign: "top", margin: 0, lineSpacing: 13,
    });
  });

  sectionTitle(s, M, 3.35, 6, "追い風の中身");
  bullets(s, [
    "Billboard JAPAN Hot 100 17位（7/15付）、動画再生指標は1位",
    "TFT公開の翌日に音源を配信＝一本の動画で終わらせない設計が奏功",
    "2026年はデビュー30周年。9月「FEST. INAZUMA」、ツアーも控える",
    "気温相関 ρ=0.80 ＝ 8月前半は構造的に一番伸びる時期",
    "TikTokでは既にダンス系・ネタ系・筋肉系のUGCが自然発生している",
    "8/7 Mステには ORANGE RANGE も同日出演（「CURRY食べたい feat.ソイソース」）",
  ], { x: M, y: 3.7, w: 5.9, h: 2.3 });

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.85, y: 3.35, w: 5.88, h: 2.28, fill: { color: RTINT }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("実証済みの「最強フォーマット」＝自虐で拾う", {
    x: 7.1, y: 3.5, w: 5.4, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
  s.addText("「口パク疑惑」を指摘された際の本人の返し", {
    x: 7.1, y: 3.85, w: 5.4, h: 0.26, fontFace: F, fontSize: 9.5, color: MUTED,
    valign: "middle", margin: 0,
  });
  s.addText("「いや、怪しいな… 55才にもなって、あんな格好してる奴が、まともに歌えるわけない！」", {
    x: 7.1, y: 4.15, w: 5.4, h: 0.72, fontFace: F, fontSize: 12.5, bold: true, color: INK,
    valign: "top", margin: 0, lineSpacing: 18,
  });
  s.addText("→ 5万いいね超。否定せず乗る／自分でイジる が最も伸びる。今回の文言案はすべてこのトーンで統一する。", {
    x: 7.1, y: 4.92, w: 5.4, h: 0.6, fontFace: F, fontSize: 10, color: INK2,
    valign: "top", margin: 0, lineSpacing: 14,
  });

  s.addText("出典：THE FIRST TAKE／Billboard JAPAN／音楽ナタリー／オリコン／スポーツ報知 ほか（2026年7月時点）", {
    x: M, y: 6.65, w: W, h: 0.28, fontFace: F, fontSize: 8.5, color: MUTED, margin: 0,
  });
}

// ================= 4. 要確認（日付ズレ） =================
{
  const s = pres.addSlide();
  head(s, "CHECK", "先に2点だけ、事実確認をさせてください", false);

  const items = [
    {
      no: "01",
      t: "資料内の「8/9 Mステ当日」は 8/7(金) が正",
      was: "元資料：3ページ目「8/9　Mステ当日（ORANGE RANGEとの集合写真）」",
      is: "ミュージックステーションの放送は 8月7日(金) 21:00〜（テレビ朝日）。8/9 は日曜日。\n「8/6 前日煽り」は 8/7 放送であれば整合するので、当日ページの日付のみ修正が必要。",
    },
    {
      no: "02",
      t: "Mステの情報解禁は 7/25 に完了済み",
      was: "共有内容：「Mステの情報解禁も今週の金曜(7/31)にある」",
      is: "出演者ラインナップと歌唱曲「HOT LIMIT」は 7/25 に音楽ナタリー・OTOTOY 等で既報。\n本資料では 7/31 を「メディア解禁」ではなく 本人・公式アカウントからの“改めての告知” として設計しています。",
    },
  ];
  items.forEach((it, i) => {
    const y = 1.5 + i * 1.62;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: W, h: 1.42, fill: { color: RTINT }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 0.26, y: y + 0.22, w: 0.42, h: 0.42, fill: { color: RED }, line: { type: "none" },
    });
    s.addText(it.no, {
      x: M + 0.26, y: y + 0.22, w: 0.42, h: 0.42, fontFace: F, fontSize: 11.5, bold: true,
      color: PAPER, align: "center", valign: "middle", margin: 0,
    });
    s.addText(it.t, {
      x: M + 0.82, y: y + 0.2, w: 10.9, h: 0.44, fontFace: F, fontSize: 15, bold: true,
      color: INK, valign: "middle", margin: 0,
    });
    s.addText(it.was, {
      x: M + 0.82, y: y + 0.63, w: 10.9, h: 0.24, fontFace: F, fontSize: 9.5, color: MUTED,
      valign: "middle", margin: 0,
    });
    s.addText(it.is, {
      x: M + 0.82, y: y + 0.87, w: 10.9, h: 0.5, fontFace: F, fontSize: 10.5, color: INK2,
      valign: "top", margin: 0, lineSpacing: 14.5,
    });
  });

  sectionTitle(s, M, 4.9, 8, "8/7(金) Mステ 出演ラインナップ");
  s.addTable([
    hdrRow(["アーティスト", "歌唱曲", "アーティスト", "歌唱曲"]),
    ["T.M.Revolution", "HOT LIMIT", "SUPER EIGHT", "Do it!!!!!"],
    ["ORANGE RANGE", "CURRY食べたい feat.ソイソース", "TOMOO", "大人になったら"],
    ["あいみょん", "愛を伝えたいだとか／スーパーガール", "マカロニえんぴつ", "終宵"],
    ["ATEEZ", "BAD (Japanese Ver.)", "HY", "AM11:00"],
  ], {
    x: M, y: 5.25, w: W, colW: [2.4, 3.66, 2.4, 3.67], rowH: 0.29,
    fontFace: F, fontSize: 9.5, color: INK2, valign: "middle",
    border: { type: "solid", color: LINE, pt: 0.75 }, margin: [3, 7, 3, 7], autoPage: false,
  });
  s.addText("※ ORANGE RANGE が同日出演＝「カレーの被り物 × HOT LIMITスーツ」の集合写真企画は成立する。先方確認のみ必要。", {
    x: M, y: 6.85, w: W, h: 0.28, fontFace: F, fontSize: 9.5, color: RED, bold: true, margin: 0,
  });
}

// ================= 5. カレンダー =================
{
  const s = pres.addSlide();
  head(s, "CALENDAR", "全体カレンダー：前3日／当日4波／後3日 ＋ お盆", false);
  table(s, [
    hdrRow(["日付", "主戦場", "やること"]),
    ["7/30(木)", "X / TikTok", "TikTokネタ投稿への本人リアクション（「面白い場所がある」と気づかせる）"],
    [{ text: "7/31(金)", options: { bold: true, color: RED } }, "X", { text: "① Mステ改めて告知　② TFTグリーンバック素材 投下 ＝ 大喜利スタート", options: { bold: true } }],
    ["8/1(土)", "X", "UGC引用ポスト 3〜5本／お題の再提示"],
    ["8/2(日)", "X / IG", "週末大喜利まとめ／IGストーリーズでUGCリポスト"],
    ["8/3(月)", "X", "ミーム画像①（熱中症警戒アラート風）"],
    ["8/4(火)", "TikTok / X", "インフルエンサー第2波を着火／ミーム画像②"],
    ["8/5(水)", "YouTube / X", "TFT切り抜きShorts 開始（毎日1本）／ミーム画像③"],
    ["8/6(木)", "全SNS", "前日煽り（衣装チラ見せ・カウントダウン・リハ風景）"],
    [{ text: "8/7(金)", options: { bold: true, color: RED } }, { text: "全SNS", options: { bold: true } }, { text: "Mステ当日 4波 ＋ TikTok公式アカウント開設", options: { bold: true } }],
    ["8/8(土)", "X / TikTok", "反響の刈り取り／TVer見逃し配信へ誘導／楽屋裏"],
    ["8/9(日)", "X", "大喜利ベスト投稿まとめ／御礼投稿"],
    ["8/10(月)〜16(日)", "全SNS", "お盆＝第2の山。帰省・猛暑ネタで自走させる"],
  ], { colW: [1.6, 1.75, 8.78], rowH: 0.33, y: 1.5 });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.95, w: W, h: 0.95, fill: { color: TINT }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("設計思想", {
    x: M + 0.26, y: 6.06, w: 1.2, h: 0.28, fontFace: F, fontSize: 11, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
  s.addText("当日に全部を乗せない。当日一発は必ず翌日に落ちる。「前で温め → 当日は番組素材が主役 → 後で刈り取り → お盆で再燃」の4段構えにして、\n本人の稼働も分散させる。本人が出すべきは「リアクション」と「一言」だけ。作り込みはチーム側で担保する。", {
    x: M + 1.5, y: 6.06, w: 10.5, h: 0.7, fontFace: F, fontSize: 10.5, color: INK2,
    valign: "top", margin: 0, lineSpacing: 15,
  });
}

// ================= 6. Section: DAY BY DAY =================
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addText("SECTION 1", {
    x: M, y: 2.6, w: 8, h: 0.35, fontFace: F, fontSize: 12, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
  s.addText("日別アクションと投稿文言案", {
    x: M, y: 3.0, w: 11, h: 0.9, fontFace: F, fontSize: 36, bold: true, color: PAPER,
    valign: "middle", margin: 0,
  });
  s.addText("7/30(木) 〜 8/16(日)　／　文言はすべて「丁寧語 ＋ 自虐 ＋ ツッコミ待ち」で統一", {
    x: M, y: 3.95, w: 11, h: 0.35, fontFace: F, fontSize: 13, color: "B9BCC4",
    valign: "middle", margin: 0,
  });
}

// ---- 日別スライド生成 ----
function daySlide({ kicker, title, aim, actions, notes, cards }) {
  const s = pres.addSlide();
  head(s, kicker, title, false);

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.5, w: 5.75, h: 1.06, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("狙い", {
    x: M + 0.22, y: 1.6, w: 0.8, h: 0.22, fontFace: F, fontSize: 9.5, bold: true,
    color: AMBER, valign: "middle", margin: 0,
  });
  s.addText(aim, {
    x: M + 0.22, y: 1.8, w: 5.3, h: 0.7, fontFace: F, fontSize: 10.5, color: PAPER,
    valign: "top", margin: 0, lineSpacing: 14,
  });

  sectionTitle(s, M, 2.66, 5.75, "アクション");
  bullets(s, actions, { x: M, y: 2.98, w: 5.75, h: 2.6 });

  if (notes) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: 5.66, w: 5.75, h: 1.26, fill: { color: RTINT }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addText(notes.t, {
      x: M + 0.22, y: 5.79, w: 5.3, h: 0.26, fontFace: F, fontSize: 11, bold: true, color: RED,
      valign: "middle", margin: 0,
    });
    s.addText(notes.d, {
      x: M + 0.22, y: 6.07, w: 5.3, h: 0.76, fontFace: F, fontSize: 10, color: INK2,
      valign: "top", margin: 0, lineSpacing: 14.5,
    });
  }

  sectionTitle(s, 6.62, 1.5, 6.11, "投稿文言案");
  let y = 1.86;
  cards.forEach((c) => {
    y += postCard(s, 6.62, y, 6.11, c[0], c[1]) + 0.14;
  });
  return s;
}

daySlide({
  kicker: "7/30 THU",
  title: "「面白い場所がある」と気づかせる",
  aim: "素材投下の前に、UGCが既に賑わっていることを本人のXで可視化する。素材だけ配っても人は動かない。「もう始まっている」と見せてから配る。",
  actions: [
    "仕込み済みのTikTok投稿から2〜3本を本人がリアクション",
    "拾う対象は意図的にばらけさせる：ダンス系／ドライヤー・扇風機のネタ系／ボディビルダー系",
    "X に TikTok の URL を貼るとカード展開されず伸びない。動画をダウンロードして X にネイティブアップする（投稿者に許諾取得）",
    "クレジットとTikTokリンクはリプライ欄に置く",
    "翌日の素材投下の直前に置くことで「反応 → 素材配布」の流れを作る",
  ],
  notes: {
    t: "この日の役割",
    d: "本人が「見ている」ことを可視化する日。7/31 の素材投下を単なる告知ではなく\n「みんなが遊んでいるから、道具も置いておきますね」という文脈に変える。",
  },
  cards: [
    ["案A", ["なんて事を…（笑）", "ちゃんと風量は「強」でお願いします。", "#HOTLIMIT"]],
    ["案B", ["完敗です。", "私のは28年かけて仕上げた“雰囲気”なので。", "#HOTLIMIT"]],
    ["案C", ["皆さん上手すぎて、本家が一番あやしいまであります。", "#HOTLIMIT"]],
    ["案D", ["朝から検索していたら、とんでもないものばかり", "出てきました。日本の夏、大丈夫でしょうか。", "#HOTLIMIT"]],
  ],
});

daySlide({
  kicker: "7/31 FRI",
  title: "素材投下 ＝ 大喜利のゴングを鳴らす",
  aim: "「見る」から「使う」へ。TFTグリーンバック素材を配り、UGCの生産コストをゼロにする。この日が施策の実質的なスタート。",
  actions: [
    "① Mステ出演を本人アカウントから改めて告知",
    "② TFTグリーンバック（白抜き）素材を投下。X／YouTube／公式サイトに常設する",
    "③ スレッド2投目でお題を明示する（「夏」「筋肉」「HOT LIMIT」）",
    "④ 素材の置き場所を一箇所にまとめる（DLページ or プロフィール固定ポスト）",
    "利用規約（商用不可・クレジット表記など）を素材と同時に掲出する",
  ],
  notes: {
    t: "お題を必ず添える",
    d: "素材だけ置いても大喜利は始まらない。「夏」「筋肉」「HOT LIMIT」の3語を提示し、\n「面白いものは全部見に行きます」と宣言することで、参加の期待値を作る。",
  },
  cards: [
    ["素材", ["素材、置いておきます。", "あとはもう、皆さんにお任せします。", "#HOTLIMIT"]],
    ["素材", ["【ご自由にどうぞ】", "「HOT LIMIT」THE FIRST TAKE のグリーンバック素材です。", "夏でも、筋肉でも、なんでも構いません。", "皆さんの夏に、勝手にお邪魔します。　#HOTLIMIT"]],
    ["お題", ["お題は「夏」「筋肉」「HOT LIMIT」。", "面白いものは全部見に行きます。　#HOTLIMIT"]],
    ["告知", ["8月7日(金)のミュージックステーション、出させていただきます。", "28年前の衣装で、地上波です。", "ご家族でご覧ください（自己責任で）。　#HOTLIMIT #Mステ"]],
  ],
});

daySlide({
  kicker: "8/1 SAT − 8/2 SUN",
  title: "週末＝大喜利のピークを作りにいく",
  aim: "土日は一般ユーザーの投稿量が最大化する。ここで「拾われる」体験を量産し、参加インセンティブを作って翌週まで持たせる。",
  actions: [
    "引用ポストで1日3〜5本ピックアップ。質より頻度（拾われる確率が上がるほど投稿が増える）",
    "IGストーリーズでもUGCをリポスト＝「本人が見ている感」の多面展開",
    "拾う対象を意図的にばらけさせる：上手い人／面白い人／子ども／高齢者／会社員／海外",
    "上手い人ばかり拾うと参加ハードルが上がりUGCが止まる。ここが最大の運用ポイント",
    "土曜の夜に一度「お題」を再掲して、日曜の投稿を引き上げる",
  ],
  notes: {
    t: "拾い方の設計",
    d: "「本人が拾ってくれるかもしれない」が唯一の参加報酬。1件あたりのコメントは\n一言でよい。件数を稼ぐことが、翌週の投稿量に直結する。",
  },
  cards: [
    ["案A", ["昨日から寄せていただいた使い方、全部見ました。", "想像の斜め上ばかりで、正直こわいです。", "#HOTLIMIT"]],
    ["案B", ["これ、私が出る必要ありましたか？", "#HOTLIMIT"]],
    ["案C", ["ご家族総出でありがとうございます。", "お子さんの将来が少し心配です。", "#HOTLIMIT"]],
    ["再掲", ["お題、もう一度置いておきます。", "「夏」「筋肉」「HOT LIMIT」。", "日曜の夜まで見ています。　#HOTLIMIT"]],
  ],
});

daySlide({
  kicker: "8/3 MON − 8/5 WED",
  title: "ミーム画像で“中だるみ”を埋める",
  aim: "解禁（7/31）と当日（8/7）の間を、話題の燃料投下で埋める。1日1本のペースで、Mステ前を厚くする。",
  actions: [
    "ミーム画像を1日1本（→ 詳細は「ミーム画像アイデア12案」ページ）",
    "8/4：TikTokインフルエンサー第2波を着火。Mステに向けて再燃させる",
    "8/5：TFT切り抜きShorts をYouTubeで開始（サビ頭15〜30秒／毎日1本）",
    "1本は「本人が自分をイジる」自虐型、1本は「公式が真顔でやる」大喜利の余白型で交互に",
    "当日〜翌日は番組素材が主役になるので、ミームはいったん止める",
  ],
  notes: {
    t: "権利まわりの確認",
    d: "AI・加工での本人肖像の扱いは事前にA&R確認。\n必ず「加工画像だと分かる作り」にして、誤情報として拡散されないようにする。",
  },
  cards: [
    ["ミーム", ["（熱中症警戒アラート風の画像とともに）", "私のせいではありません。たぶん。", "#HOTLIMIT"]],
    ["ミーム", ["（気温との相関グラフとともに）", "調べていただいたところ、相関係数0.80だそうです。", "統計的に、否定できませんでした。　#HOTLIMIT"]],
    ["ミーム", ["（28年前 vs 2026 の比較画像とともに）", "何も学んでいません。", "#HOTLIMIT"]],
    ["連動", ["扇風機の前で撮っていただいた皆さん、", "今週末はエアコンもお使いください。", "#HOTLIMIT"]],
  ],
});

daySlide({
  kicker: "8/6 THU",
  title: "前日煽り：「明日21時、テレビの前へ」",
  aim: "全プラットフォームで「明日21時」を刷り込む。焦らす見せ方（衣装の一部だけ）で当日の期待値を上げる。",
  actions: [
    "X：明日告知 ＋ 衣装カット。時刻（21:00）とチャンネル（テレビ朝日）を必ず明記",
    "TikTok：「明日のリハ」風の縦型動画。後ろ姿・シルエット・衣装の一部だけ＝焦らす",
    "Instagram：ストーリーズにカウントダウンスタンプを設置",
    "YouTube：コミュニティ投稿でアンケート「今夜見ますか？」＝通知が飛ぶ",
    "翌日の TikTok公式アカウント開設を予告しておく（フォロー先を事前に作る）",
  ],
  notes: {
    t: "素材の準備期限",
    d: "衣装カット・TikTok初投稿3本・当日用テキストはこの日までに全て完成させる。\n当日は撮って出しに専念できる状態にしておく。",
  },
  cards: [
    ["前日", ["明日です。", "28年前の衣装、地上波、21時。", "冷房を強めにしてお待ちください。", "#HOTLIMIT #Mステ"]],
    ["前日", ["明日、日本の夏をもう一度刺激しに行きます。", "#HOTLIMIT #Mステ"]],
    ["予告", ["明日、TikTokも始めます。", "この歳で、何を始めているんでしょうか。", "#HOTLIMIT"]],
    ["リハ", ["（後ろ姿のリハ動画とともに）", "まだ見せられません。", "というより、見せない方がいい気がしてきました。"]],
  ],
});

// ---- 8/7 タイムライン ----
{
  const s = pres.addSlide();
  head(s, "8/7 FRI ｜ Mステ当日", "当日は4波で撃つ ＋ TikTok公式アカウント開設", false);

  s.addTable([
    hdrRow(["時刻", "媒体", "内容"]),
    ["07:00", "X", "「本日、刺激します。」＋ 衣装カット"],
    [{ text: "12:00", options: { bold: true, color: RED } }, { text: "TikTok", options: { bold: true } }, { text: "公式アカウント開設・初投稿。同時にX／IGで開設告知", options: { bold: true } }],
    ["17:00", "IG / TikTok", "楽屋入り・リハ風景（ストーリーズ＋縦型）"],
    ["20:50", "X", "「そろそろです」＋ テレビの前へ誘導"],
    ["OA中", "X", "出番直前「まもなくです」／歌唱直後「ありがとうございました」"],
    [{ text: "21:30〜", options: { bold: true, color: RED } }, "X / IG", { text: "ORANGE RANGEとの集合写真（カレー×HOT LIMITスーツ）", options: { bold: true } }],
    ["23:00", "X", "番組の反響 ＋ UGCまとめの引用ポスト"],
    ["00:00", "TikTok", "当日ダイジェスト（縦型）"],
  ], {
    x: M, y: 1.5, w: 7.3, colW: [0.95, 1.15, 5.2], rowH: 0.3,
    fontFace: F, fontSize: 9.5, color: INK2, valign: "middle",
    border: { type: "solid", color: LINE, pt: 0.75 }, margin: [3, 7, 3, 7], autoPage: false,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 8.1, y: 1.5, w: 4.63, h: 2.6, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("TikTok公式アカウント 初投稿の候補", {
    x: 8.34, y: 1.66, w: 4.15, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: AMBER,
    valign: "middle", margin: 0,
  });
  s.addText("開設72時間が勝負。初日3本、以降1日1〜2本を2週間。", {
    x: 8.34, y: 1.98, w: 4.15, h: 0.26, fontFace: F, fontSize: 9.5, color: "B9BCC4",
    valign: "middle", margin: 0,
  });
  [
    ["1", "本人が自分のUGCを見るリアクション動画", "最優先。既にUGCがある強みをそのまま使える"],
    ["2", "TFTの舞台裏／本番前の声出し", "TFTからの流入をそのまま受け止める"],
    ["3", "HOT LIMITスーツの着方", "ネタでありつつ実用系＝保存されやすい"],
  ].forEach(([n, t, d], i) => {
    const y = 2.32 + i * 0.58;
    s.addShape(pres.ShapeType.ellipse, {
      x: 8.34, y: y + 0.03, w: 0.28, h: 0.28, fill: { color: RED }, line: { type: "none" },
    });
    s.addText(n, {
      x: 8.34, y: y + 0.03, w: 0.28, h: 0.28, fontFace: F, fontSize: 9, bold: true,
      color: PAPER, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: 8.72, y, w: 3.8, h: 0.28, fontFace: F, fontSize: 10.5, bold: true, color: PAPER,
      valign: "middle", margin: 0,
    });
    s.addText(d, {
      x: 8.72, y: y + 0.27, w: 3.8, h: 0.26, fontFace: F, fontSize: 9, color: "AEB2BB",
      valign: "middle", margin: 0,
    });
  });

  sectionTitle(s, M, 5.15, 7.3, "当日の運用ルール");
  bullets(s, [
    "本人は「撮って出し」と「一言」に専念。編集物はチーム側で事前に用意する",
    "OA中の投稿は歌唱の“直前”と“直後”の2本に絞る（連投は逆効果）",
    "番組素材の二次利用範囲をテレビ朝日に事前確認（写真・映像の可否とタイミング）",
    "ORANGE RANGE 集合写真はレーベル／マネジメントの事前合意を取っておく",
  ], { x: M, y: 5.48, w: 7.3, h: 1.45, fontSize: 10.5, lineSpacing: 15.5, paraSpaceAfter: 5 });

  sectionTitle(s, 8.1, 4.22, 4.63, "当日の文言案");
  let cy = 4.56;
  cy += postCard(s, 8.1, cy, 4.63, "直前", ["21時です。28年分、いきます。", "#HOTLIMIT #Mステ"]) + 0.1;
  cy += postCard(s, 8.1, cy, 4.63, "直後", ["今夜は日本の夏を刺激しすぎてしまいました。", "カレーもいただきました。　#HOTLIMIT #Mステ"]) + 0.1;
  postCard(s, 8.1, cy, 4.63, "締め", ["明日の気温は、私のせいでは", "ありません。　#HOTLIMIT"]);
}

daySlide({
  kicker: "8/8 SAT − 8/10 MON",
  title: "刈り取り：放送直後の検索需要を取り切る",
  aim: "放送で生まれた関心が最も高い72時間。新規で知った層を「見る人」から「フォローする人」に変換する。",
  actions: [
    "TVer見逃し配信へ誘導（放送直後の検索需要をここで受け止める）",
    "「#HOTLIMIT 大喜利」ベスト投稿まとめ（X スレッド／IGカルーセル）",
    "TikTok公式：Mステ楽屋裏／ORANGE RANGEとの絡み／本番前の様子",
    "YouTube：プレイリスト「HOT LIMIT 2026」を整備（TFT／原曲MV／ライブ／ダンス）",
    "本人から御礼投稿。ここで次（30周年・ツアー・FEST. INAZUMA）を軽く匂わせる",
  ],
  notes: {
    t: "新規フォロワーの受け皿",
    d: "Mステで初めて知った層が最初に見るのはプロフィールと固定ポスト。\n固定ポストをグリーンバック素材（＝参加導線）に差し替えておく。",
  },
  cards: [
    ["御礼", ["ご覧いただきありがとうございました。", "28年経っても、まだ怒られない格好で歌えています。", "#HOTLIMIT #Mステ"]],
    ["誘導", ["見逃した方へ。", "TVerにございます。心の準備をしてからどうぞ。", "#HOTLIMIT #Mステ"]],
    ["まとめ", ["この一週間の #HOTLIMIT、", "個人的なベストを貼っておきます。（スレッド）"]],
  ],
});

daySlide({
  kicker: "8/11 TUE − 8/16 SUN",
  title: "お盆＝第2の山。ここを捨てない",
  aim: "気温相関 ρ=0.80。お盆は「帰省 × 猛暑 × 家族団らん」で世代を超えて刺さる、放送日と同等の追い風がある窓。",
  actions: [
    "「実家で HOT LIMIT を流す」ネタの誘導＝家族巻き込み型UGCへ",
    "8/15前後の猛暑ピークに合わせた自虐投稿（「すいません」フォーマットの再利用）",
    "夏の終わりに向けた「今年の #HOTLIMIT ベスト」総集編（X／IGカルーセル／YouTube）",
    "TikTok公式は1日1本を維持。ここで止めるとアカウントが死ぬ",
    "次の一手の予告：30周年／ツアー／FEST. INAZUMA（9月）へ接続する",
  ],
  notes: {
    t: "ORANGE RANGE 事例からの学び",
    d: "「地上波はゴールではなく中継点」。紅白の前に何度も踊り場を作ったのが効いた。\nMステ後に施策を畳まず、次の露出まで熱を継続させる。",
  },
  cards: [
    ["お盆", ["帰省先で流すのは、各ご家庭の判断でお願いします。", "#HOTLIMIT"]],
    ["猛暑", ["今日も暑いですね。", "そろそろ本気で申し訳なくなってきました。", "#HOTLIMIT"]],
    ["総集編", ["この夏の #HOTLIMIT、", "全部見ました。来年もやりましょう。"]],
  ],
});

// ================= Section 2: PLATFORM =================
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addText("SECTION 2", {
    x: M, y: 2.6, w: 8, h: 0.35, fontFace: F, fontSize: 12, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
  s.addText("プラットフォーム別 施策", {
    x: M, y: 3.0, w: 11, h: 0.9, fontFace: F, fontSize: 36, bold: true, color: PAPER,
    valign: "middle", margin: 0,
  });
  s.addText("X＝拡散　／　TikTok＝UGC生産　／　YouTube＝受け皿と検索　／　Instagram＝世界観と“見ている感”", {
    x: M, y: 3.95, w: 12, h: 0.35, fontFace: F, fontSize: 13, color: "B9BCC4",
    valign: "middle", margin: 0,
  });
}

function platformSlide({ kicker, title, role, left, right, tip }) {
  const s = pres.addSlide();
  head(s, kicker, title, false);
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.5, w: W, h: 0.6, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText(role, {
    x: M + 0.26, y: 1.5, w: W - 0.52, h: 0.6, fontFace: F, fontSize: 12.5, bold: true,
    color: PAPER, valign: "middle", margin: 0,
  });
  sectionTitle(s, M, 2.25, 5.9, left.t);
  bullets(s, left.i, { x: M, y: 2.58, w: 5.9, h: 3.3 });
  sectionTitle(s, 6.83, 2.25, 5.9, right.t);
  bullets(s, right.i, { x: 6.83, y: 2.58, w: 5.9, h: 3.3 });
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.95, w: W, h: 0.95, fill: { color: RTINT }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText(tip.t, {
    x: M + 0.26, y: 6.06, w: 2.4, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: RED,
    valign: "middle", margin: 0,
  });
  s.addText(tip.d, {
    x: M + 2.75, y: 6.06, w: 9.25, h: 0.72, fontFace: F, fontSize: 10.5, color: INK2,
    valign: "top", margin: 0, lineSpacing: 15,
  });
  return s;
}

platformSlide({
  kicker: "X",
  title: "X：拡散の主戦場。本人アカウントが全ての起点",
  role: "役割｜UGCを増幅し、話題を「事件」にする。本人の一言が最大の武器。",
  left: {
    t: "運用ルール",
    i: [
      "投稿頻度：平常1〜2/日 → 8/5〜8/9 は 4〜6/日 に引き上げる",
      "動画は必ずネイティブアップ。TikTok／YouTubeのURL貼りは表示が伸びない",
      "リンクはリプライ欄に置く（本ポストのリーチを守る）",
      "引用ポストは「短い一言 ＋ #HOTLIMIT」が最も回る（実績：「出ました♪」）",
      "大喜利はお題を明示して投稿ハードルを下げる",
      "本人ポストは2〜3行＋ハッシュタグ。長文にしない",
      "タグは #HOTLIMIT に統一（表記ゆれは集計も拡散も分断する）",
    ],
  },
  right: {
    t: "打ち手",
    i: [
      "TFTグリーンバック素材をプロフィール固定ポストに常設",
      "ネガ・イジりは否定せず乗る（口パク騒動のフォーマット化）",
      "Mステ直後にスペース（音声）を10分だけ＝深夜の余韻を拾う",
      "ミーム画像を1日1本（8/3〜8/6）。当日〜翌日は番組素材に譲る",
      "他アーティスト公式（ORANGE RANGE／Mステ／THE FIRST TAKE）へのメンション設計",
      "告知はスタッフアカウント、リアクションは本人アカウントで役割分担",
      "リプライ欄の面白いコメントも拾う（「いいね」も可視化される）",
    ],
  },
  tip: {
    t: "最重要ポイント",
    d: "TikTokのUGCをXへ転載する導線を必ず用意する。TikTokの中だけでは「事件」にならない。\nXで話題化 → メディアが拾う → さらにTikTokへ、という循環を回すのが今回の勝ち筋。転載時は投稿者の許諾を必ず取得する。",
  },
});

platformSlide({
  kicker: "TIKTOK",
  title: "TikTok：UGCの主戦場。8/7 に公式アカウント開設",
  role: "役割｜UGCを生産し続ける工場。開設72時間の初速がその後の伸びを決める。",
  left: {
    t: "コンテンツ設計（優先順）",
    i: [
      "① 本人のUGCリアクション動画 ← 最優先。既存UGCをそのまま資産化できる",
      "② 衣装の着脱・裏側（生活感 × 非日常のギャップ）",
      "③ TFTの舞台裏／本番前の声出し",
      "④ 「本家やってみた」＝インフルエンサー振付を本人が踊る",
      "⑤ ORANGE RANGE とのコラボ（Mステ楽屋／相互出演）",
      "⑥ コメント返し動画＝TikTok内で最も低コストかつ継続しやすい型",
      "⑦ 「28年前と同じ衣装が入るか」検証系＝数字が取れる企画もの",
    ],
  },
  right: {
    t: "仕込みと設計",
    i: [
      "インフルエンサー第2波を 8/4〜8/6 に着火。4象限で配分：ダンス系／ネタ系（ドライヤー・扇風機）／筋肉系（ボディビルダー）／親子・主婦系",
      "楽曲ページの整備：TFT音源と原曲の両方にUGCが集まる。サムネと楽曲名表記を確認",
      "デュエット／ステッチ前提で撮る：正面・上半身固定・無音区間あり",
      "Mステ翌日に TikTok LIVE を短時間（UGCを一緒に見る配信）",
      "タグ：#HOTLIMIT #TMRevolution #西川貴教 ＋ 季節タグ",
    ],
  },
  tip: {
    t: "開設初日の設計",
    d: "初日は3本。1本目は必ず「本人がUGCを見るリアクション」にする。ゼロから作るのではなく、既に存在する盛り上がりに\n本人が乗る形が最も回り、かつ制作コストも最も低い。以降は1日1〜2本を最低2週間、お盆明けまで止めない。",
  },
});

platformSlide({
  kicker: "YOUTUBE",
  title: "YouTube：受け皿と検索。放送後の流入を取り切る",
  role: "役割｜TFTで生まれた関心と、Mステで生まれた検索需要を受け止める場所。",
  left: {
    t: "コンテンツ",
    i: [
      "TFT切り抜き Shorts を 8/5〜8/10 で毎日1本（サビ頭15〜30秒）",
      "グリーンバック素材をYouTubeにも常設（素材動画としてアップ）",
      "プレイリスト「HOT LIMIT 2026」＝TFT／原曲MV／ライブ映像／ダンス",
      "Mステ後にプレミア公開：MVリマスター or 「HOT LIMIT 28年の変遷」",
      "コミュニティ投稿で告知・アンケート（登録者に通知が飛ぶ）",
      "UGCまとめ動画（許諾取得のうえ）＝参加者がさらに増える循環を作る",
      "ライブ映像のアーカイブを整理して回遊先を増やす",
    ],
  },
  right: {
    t: "検索・連携",
    i: [
      "タイトル・サムネに「Mステ」「THE FIRST TAKE」「2026」を入れて検索流入を取る",
      "「HOT LIMIT 歌詞」「HOT LIMIT 衣装」など周辺検索も概要欄で拾う",
      "THE FIRST TAKE 公式チャンネルとの連携：Mステ当日の再ポストを打診",
      "終了画面・カード設定を全動画で見直す（TFT → MV → プレイリスト）",
      "Shortsの冒頭1秒に「28年前の衣装」の画を置く＝離脱を止める最短手",
      "8/7 当日はコミュニティ投稿を朝・直前の2回（通知がテレビ誘導に効く）",
    ],
  },
  tip: {
    t: "既に週間1位である前提で組む",
    d: "YouTubeチャートで2週連続1位（週間627.1万再生）を取っている。ここは「伸ばす」より「落とさない」設計が正解。\nShortsで毎日접点を作り、Mステ後の検索流入をプレイリストに流し込んで、8/7週も1位を維持する。",
  },
});

platformSlide({
  kicker: "INSTAGRAM",
  title: "Instagram：世界観と「本人が見ている感」",
  role: "役割｜きれいめの世界観を担保しつつ、ストーリーズでUGCを毎日拾い続ける。",
  left: {
    t: "フィード／リール",
    i: [
      "リール：TikTokと同素材でよいが、IGは“きれいめ”＋テロップ多めに調整",
      "リールテンプレート公開：グリーンバック素材を使ったテンプレを配布＝IG側のUGC導線",
      "カルーセル：28年前 vs 2026 の比較／ミーム画像まとめ／大喜利ベスト",
      "コラボ投稿（共同投稿者）：ORANGE RANGE公式／Mステ公式／THE FIRST TAKE公式",
      "リールの音源は原曲とTFT版の両方を使い分ける（発見面での露出を二重化）",
      "キャプションは1行目で完結させる。IGは「続きを読む」で離脱する",
    ],
  },
  right: {
    t: "ストーリーズ（当日の主役）",
    i: [
      "当日実況：朝 → 楽屋 → 直前 → 直後 の4本立て",
      "カウントダウンスタンプ（8/6設置 → 8/7 21:00 に着火）",
      "アンケート／クイズ：「今夜見ますか？」「何年前の衣装でしょう？」",
      "メンション拾い：毎日UGCをリポスト。ハイライトに「#HOTLIMIT」を常設",
      "リンクスタンプでTVer／YouTubeへ誘導（8/8〜）",
      "質問ボックスで「HOT LIMITの思い出」を募集＝翌日の投稿ネタが溜まる",
    ],
  },
  tip: {
    t: "IGの役割は“量”ではなく“継続”",
    d: "XとTikTokが瞬間最大風速を担うのに対し、IGは毎日UGCを拾い続けて「本人が全部見ている」という信頼を積む場所。\nストーリーズのリポストは1日3〜5件を8/1から8/16まで途切れさせないこと。",
  },
});

// ================= ミーム画像アイデア =================
{
  const s = pres.addSlide();
  head(s, "IDEA", "X ミーム画像アイデア 12案（過去画像 × 加工）", false);
  s.addText("コツは「誰もが知っている見慣れた形式」に落とすこと。フォーマットが既知だから、説明なしで一瞬で伝わる。", {
    x: M, y: 1.42, w: W, h: 0.3, fontFace: F, fontSize: 11, color: MUTED, margin: 0, valign: "middle",
  });

  const ideas = [
    ["01", "熱中症警戒アラート風", "「本日の暑さ指数：HOT LIMIT」"],
    ["02", "全国天気予報テロップ風", "「明日も全国的にHOT LIMITでしょう」"],
    ["03", "相関グラフ（実データ）", "ρ=0.80 をネタに「統計的に否定できませんでした」"],
    ["04", "駅の運行情報風", "「◯◯線 遅延（原因：HOT LIMIT）」"],
    ["05", "組立説明図風（IKEA風）", "HOT LIMITスーツの装着手順 ピクトグラム"],
    ["06", "人体解剖図／筋肉図鑑風", "「HOT LIMIT筋（1998–2026）」"],
    ["07", "昆虫図鑑風", "「HOT LIMITの妖精（滋賀県固有種）」※既存ミーム活用"],
    ["08", "家電の省エネラベル風", "「消費電力★★★★★／発熱量：規格外」"],
    ["09", "卒業アルバム／学級新聞風", "28年前 vs 2026「変わらなすぎ選手権」"],
    ["10", "帰省ラッシュ予測図風", "「上り：混雑／下り：混雑／全身：露出」"],
    ["11", "給食の献立表風", "ORANGE RANGE と絡めて「本日の給食：カレー、HOT LIMIT」"],
    ["12", "間違い探し", "Mステ出演者ラインナップ画像を使って"],
  ];
  ideas.forEach(([n, t, d], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * 4.12, y = 1.85 + row * 1.15;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 3.89, h: 1.0, fill: { color: i % 2 ? TINT : RTINT }, rectRadius: 0.07, line: { type: "none" },
    });
    s.addText(n, {
      x: x + 0.2, y: y + 0.13, w: 0.4, h: 0.26, fontFace: F, fontSize: 12, bold: true,
      color: RED, valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: x + 0.62, y: y + 0.13, w: 3.1, h: 0.26, fontFace: F, fontSize: 11.5, bold: true,
      color: INK, valign: "middle", margin: 0,
    });
    s.addText(d, {
      x: x + 0.2, y: y + 0.44, w: 3.5, h: 0.48, fontFace: F, fontSize: 9.5, color: INK2,
      valign: "top", margin: 0, lineSpacing: 13,
    });
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 6.55, w: W, h: 0.62, fill: { color: INK }, rectRadius: 0.07, line: { type: "none" },
  });
  s.addText("出し方｜8/3〜8/6 に1日1本 → 当日〜翌日は番組素材が主役なので停止 → 8/12以降にお盆版を再開。AI加工は必ずA&R確認のうえ「加工画像と分かる作り」で。", {
    x: M + 0.26, y: 6.55, w: W - 0.52, h: 0.62, fontFace: F, fontSize: 10.5, color: PAPER,
    valign: "middle", margin: 0,
  });
}

// ================= 参考事例 ORANGE RANGE =================
{
  const s = pres.addSlide();
  head(s, "CASE STUDY", "参考事例：ORANGE RANGE「ナツい夏★プロジェクト」", false);
  s.addText("ベテラン → TikTok起点のリバイバル → 地上波再登場。今回と同型のフォーマットで、しかも 8/7 Mステに同日出演している。", {
    x: M, y: 1.42, w: W, h: 0.3, fontFace: F, fontSize: 11, color: MUTED, margin: 0, valign: "middle",
  });

  s.addTable([
    hdrRow(["時期", "出来事"]),
    ["2025/5", "ソニーミュージックと再契約"],
    ["2025/7", "「ナツい夏★プロジェクト」始動 ＝ 単発ではなくプロジェクト名を付けた"],
    ["2025/7/2", "「イケナイ太陽」令和版MV公開（お笑いコンビ・マユリカ出演／平成あるある72個）"],
    ["2025年夏", "TikTokで「おしゃれ番長 feat.ソイソース」がバイラル。インフルエンサー・著名人がダンス投稿"],
    ["2025年夏", "Billboard JAPAN Hot 100 動画再生指標で2週連続1位"],
    ["2025/12/31", "紅白歌合戦 19年ぶり出場"],
    ["2026/7/13", "「CURRY食べたい feat.ソイソース」リリース（「SUSHI食べたい」の続編＝シリーズ化）"],
    ["2026/8/7", "ミュージックステーション出演（＝T.M.Revolution と同日）"],
  ], {
    x: M, y: 1.85, w: W, colW: [1.7, 10.43], rowH: 0.34,
    fontFace: F, fontSize: 10, color: INK2, valign: "middle",
    border: { type: "solid", color: LINE, pt: 0.75 }, margin: [4, 7, 4, 7], autoPage: false,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.35, w: W, h: 1.55, fill: { color: INK }, rectRadius: 0.08, line: { type: "none" },
  });
  s.addText("この事例の本質", {
    x: M + 0.26, y: 5.5, w: 3, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: AMBER,
    valign: "middle", margin: 0,
  });
  s.addText("紅白（＝ゴールに見える露出）の前に、令和版MV・TikTokバイラル・チャート実績と、何度も「踊り場」を作っていた。\n一発の露出で終わらせず、次の露出まで熱を渡し続ける設計になっていたことが、19年ぶりの紅白につながっている。\nT.M.Revolution 側も Mステを終着点にせず、30周年／ツアー／FEST. INAZUMA（9月）へ熱を渡す設計にする。", {
    x: M + 0.26, y: 5.82, w: 11.6, h: 1.0, fontFace: F, fontSize: 10.5, color: "D5D7DC",
    valign: "top", margin: 0, lineSpacing: 15.5,
  });
}

// ================= 転用ポイント =================
{
  const s = pres.addSlide();
  head(s, "TAKEAWAY", "事例からの転用ポイント 6つ", false);
  const tk = [
    ["01", "「懐かしさ」ではなく「新作」として扱う", "令和版MV ↔ THE FIRST TAKE版。過去曲を今の形式で作り直したから、懐メロ枠に入らずに現役の曲として受け取られた。"],
    ["02", "プロジェクト名を付ける", "「ナツい夏★プロジェクト」は単発施策を連続体に変える装置。T.M.R.側も統一タグ／名前（例：#HOTLIMIT2026）を検討する価値がある。"],
    ["03", "お笑い・インフルエンサーを「翻訳者」に置く", "マユリカがファン外への橋渡しになった。今回のドライヤーネタ・ボディビルダー投稿も同じ役割。ファンではない層の入口を必ず作る。"],
    ["04", "媒体ごとの役割を割り切る", "UGCの生産はTikTok、拡散と話題化はX、受け皿と検索はYouTube、継続の信頼はInstagram。全媒体で同じことをしない。"],
    ["05", "地上波はゴールでなく中継点", "Mステの翌日に施策を畳まない。8/8〜8/10 の刈り取りと、お盆（8/11〜16）の第2の山までを一つの設計に含める。"],
    ["06", "次の一手を用意しておく", "SUSHI → CURRY のシリーズ化。T.M.R.は30周年・ツアー・FEST. INAZUMA（9月）が控える。Mステ後にそこへ接続する。"],
  ];
  tk.forEach(([n, t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.19, y = 1.5 + row * 1.78;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 5.94, h: 1.6, fill: { color: TINT }, rectRadius: 0.08, line: { type: "none" },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.24, y: y + 0.2, w: 0.4, h: 0.4, fill: { color: RED }, line: { type: "none" },
    });
    s.addText(n, {
      x: x + 0.24, y: y + 0.2, w: 0.4, h: 0.4, fontFace: F, fontSize: 11, bold: true,
      color: PAPER, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: x + 0.76, y: y + 0.18, w: 5.0, h: 0.44, fontFace: F, fontSize: 12.5, bold: true,
      color: INK, valign: "middle", margin: 0,
    });
    s.addText(d, {
      x: x + 0.24, y: y + 0.68, w: 5.5, h: 0.82, fontFace: F, fontSize: 10, color: INK2,
      valign: "top", margin: 0, lineSpacing: 14,
    });
  });
}

// ================= 素材リスト =================
{
  const s = pres.addSlide();
  head(s, "OPERATION", "必要素材リストと、事前に潰しておく確認事項", false);

  sectionTitle(s, M, 1.45, 6, "素材リスト");
  s.addTable([
    hdrRow(["素材", "用途", "期限"]),
    ["TFT グリーンバック（白抜き）映像", "UGCの燃料。全SNSに常設", "7/31"],
    ["過去の西川さん画像（高解像）", "ミーム画像の加工用。A&Rから受領", "8/1"],
    ["ミーム画像 3〜6本", "8/3〜8/6 に1日1本", "8/2"],
    ["TFT切り抜き Shorts 6本", "8/5〜8/10 に毎日1本", "8/4"],
    ["衣装カット（当日・前日用）", "8/6 前日煽り／8/7 朝", "8/6"],
    ["TikTok公式アカウント 初投稿3本", "8/7 開設", "8/6"],
    ["Mステ楽屋・ORANGE RANGE集合写真", "当日OA後", "8/7（番組側と要調整）"],
  ], {
    x: M, y: 1.8, w: 6.05, colW: [2.85, 2.1, 1.1], rowH: 0.4,
    fontFace: F, fontSize: 9.5, color: INK2, valign: "middle",
    border: { type: "solid", color: LINE, pt: 0.75 }, margin: [3, 6, 3, 6], autoPage: false,
  });

  sectionTitle(s, 6.98, 1.45, 5.75, "確認事項（着手前に潰す）");
  const checks = [
    "リアクション対象UGCの投稿者許諾（X転載する場合は必須）",
    "ミーム画像のAI加工について、本人肖像の扱いをA&R確認",
    "加工画像だと分かる作りにする（特に警報・天気予報フォーマット）",
    "Mステ番組素材の二次利用範囲をテレビ朝日に確認（写真・映像の可否とタイミング）",
    "ORANGE RANGE 集合写真の先方確認（レーベル／マネジメント）",
    "グリーンバック素材の利用規約（商用不可・クレジット表記）を明文化して同時掲出",
    "THE FIRST TAKE 公式チャンネルとの連携可否を打診",
    "TikTok公式アカウント名・アイコン・プロフィール文の確定（8/6まで）",
  ];
  checks.forEach((c, i) => {
    const y = 1.82 + i * 0.53;
    s.addShape(pres.ShapeType.roundRect, {
      x: 6.98, y, w: 0.32, h: 0.32, fill: { color: PAPER }, rectRadius: 0.05,
      line: { color: RED, width: 1.25 },
    });
    s.addText(c, {
      x: 7.44, y: y - 0.04, w: 5.29, h: 0.42, fontFace: F, fontSize: 10, color: INK2,
      valign: "middle", margin: 0, lineSpacing: 13.5,
    });
  });
}

// ================= クロージング =================
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addText("最後に、外してはいけない5点", {
    x: M, y: 0.75, w: 11, h: 0.7, fontFace: F, fontSize: 30, bold: true, color: PAPER,
    valign: "middle", margin: 0,
  });
  const pts = [
    ["当日に全部を乗せない", "前3日／当日4波／後3日で分散する。当日一発は必ず翌日に落ちる。"],
    ["本人の稼働を守る", "本人が出すべきは「リアクション」と「一言」だけ。作り込みはチーム側で担保する。"],
    ["拾う対象を偏らせない", "上手い人ばかり拾うと参加ハードルが上がり、UGCが止まる。子ども・高齢者・会社員・海外まで散らす。"],
    ["イジりには乗る", "否定・訂正は熱量を殺す。口パク騒動の成功事例をそのままフォーマットとして使う。"],
    ["お盆を捨てない", "気温相関 ρ=0.80。8/15前後は放送日と同等の追い風がある。ここで畳むのが一番もったいない。"],
  ];
  pts.forEach(([t, d], i) => {
    const y = 1.72 + i * 1.02;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: W, h: 0.88, fill: { color: INK2 }, rectRadius: 0.07, line: { type: "none" },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 0.28, y: y + 0.24, w: 0.4, h: 0.4, fill: { color: RED }, line: { type: "none" },
    });
    s.addText(String(i + 1), {
      x: M + 0.28, y: y + 0.24, w: 0.4, h: 0.4, fontFace: F, fontSize: 11, bold: true,
      color: PAPER, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, {
      x: M + 0.85, y: y + 0.11, w: 3.5, h: 0.33, fontFace: F, fontSize: 13.5, bold: true,
      color: AMBER, valign: "middle", margin: 0,
    });
    s.addText(d, {
      x: M + 0.85, y: y + 0.44, w: 10.9, h: 0.34, fontFace: F, fontSize: 10.5, color: "C9CCD2",
      valign: "middle", margin: 0,
    });
  });
  s.addText("出典：音楽ナタリー／OTOTOY／Billboard JAPAN／THE FIRST TAKE／オリコン／スポーツ報知／女性自身（いずれも2026年7月時点の公開情報）", {
    x: M, y: 6.95, w: W, h: 0.3, fontFace: F, fontSize: 8.5, color: "8A8F98", margin: 0,
  });
}

pres.writeFile({ fileName: "/tmp/claude-0/-home-user-claude/5e1c8850-3fd6-5e82-8bfb-37b9e2e8b342/scratchpad/deck/TMR_HOTLIMIT_SNS.pptx" })
  .then((f) => console.log("wrote", f));
