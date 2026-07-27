// 収集した YouTube コメントから、TAK のリスナー国・言語構成を推定する。
//  (A) 言語判定 = 文字体系ルール + franc(n-gram, 言語ホワイトリスト付き) + 短文用の語彙辞書
//  (B) 国旗絵文字 … 自己申告なので最も直接的な国シグナル
//  (C) 国名・地名メンション
// いいね数で加重した分布も併せて出す（1コメント=1人ではなく、賛同数で重み付けするため）。
import fs from 'fs';
import path from 'path';
import { franc, francAll } from 'franc';

const RAW = 'data/raw';
const ONLY = ['eng','ind','zlm','tgl','vie','spa','por','tur','fra','deu','ita','pol','ron','nld','ces','swe','hun','fin'];

const RE = {
  hangul: /[가-힣ᄀ-ᇿ]/,
  kana:   /[぀-ゟ゠-ヿ]/,
  han:    /[一-鿿]/,
  thai:   /[฀-๿]/,
  cyr:    /[Ѐ-ӿ]/,
  arab:   /[؀-ۿ]/,
  hebrew: /[֐-׿]/,
  deva:   /[ऀ-ॿ]/,
  greek:  /[Ͱ-Ͽ]/,
  latin:  /[A-Za-zÀ-ÿĀ-ž]/,
  viet:   /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/,
};
const TRAD = /[說們這來時個為對後點麼樣過發現實聲學麗歡體萬雙靈嗎將樂灣華會]/;

// 短文（franc が効かない長さ）向けの語彙辞書
const SHORT = {
  id: ['banget','bgt','lagu','keren','aku','gua','gue','wkwk','anjay','anjir','mantap','bikin','emang','udah','nggak','gak','njir','wibu','imut','lucu','sih','dong','kok','deh','parah','bener','indo','suka','enak','sangat','bagus'],
  tl: ['grabe','sobrang','kasi','yung','ganda','talaga','naman','astig','pinoy','filipino','ang '],
  vi: ['bài','nhạc','nghe','quá','mình','được','không','hay quá'],
  es: ['canción','cancion','muy ','hermos','lindo','gusta','porque','tambien','también','español','buenísim'],
  pt: ['não','música','musica','muito','você','adoro','brasil','viciad'],
  tr: ['şarkı','çok','güzel','türk','bayıld'],
  en: ['the ','this','song','love','you','and ','best','peak','fire','banger','omg','miku','so ','my ','why','goat','cute','good','amazing','masterpiece','part','yeah','bro','lyrics','addict'],
};

function detect(text) {
  const t = text.toLowerCase();
  if (RE.hangul.test(text)) return 'ko';
  if (RE.kana.test(text))   return 'ja';
  if (RE.thai.test(text))   return 'th';
  if (RE.cyr.test(text))    return 'ru';
  if (RE.arab.test(text))   return 'ar';
  if (RE.hebrew.test(text)) return 'he';
  if (RE.deva.test(text))   return 'hi';
  if (RE.greek.test(text))  return 'el';
  if (RE.han.test(text))    return TRAD.test(text) ? 'zh-Hant' : 'zh-Hans';
  if (RE.viet.test(text))   return 'vi';
  const letters = (text.match(/[A-Za-zÀ-ÿĀ-ž]/g) ?? []).length;
  if (letters === 0) return 'emoji_only';

  // 十分な長さがあれば n-gram 判定を使う。ただし英語コメントが仏語/蘭語などに
  // 誤判定されやすいので、英語スコアを明確に上回った場合のみ非英語を採用する。
  if (letters >= 20) {
    const map = { eng:'en', ind:'id', zlm:'id', tgl:'tl', vie:'vi', spa:'es', por:'pt',
                  tur:'tr', fra:'fr', deu:'de', ita:'it', pol:'pl', ron:'ro', nld:'nl',
                  ces:'cs', swe:'sv', hun:'hu', fin:'fi' };
    const all = francAll(text, { only: ONLY, minLength: 10 });
    const scores = Object.fromEntries(all);
    const [topCode, topScore] = all[0] ?? [];
    const engScore = scores.eng ?? 0;
    if (topCode === 'eng') return 'en';
    // 非英語と判定するには英語より十分に高いスコアが要る（誤検知抑制）
    if (map[topCode] && topScore - engScore >= 0.06 && letters >= 25) return map[topCode];
    return 'en';
  }
  // 短文は語彙辞書
  let best = null, bestScore = 0;
  for (const [lang, words] of Object.entries(SHORT)) {
    let s = 0;
    for (const w of words) if (t.includes(w)) s += w.length >= 5 ? 2 : 1;
    if (lang === 'en') s *= 0.8;
    if (s > bestScore) { bestScore = s; best = lang; }
  }
  if (bestScore >= 1) return best;
  return letters >= 3 ? 'en?' : 'unknown'; // ラテン文字のみの短文は英語圏寄りとして別枠
}

const FLAG = /[\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}]/gu;
const flagToCC = (f) => [...f].map((c) => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 65)).join('');

const COUNTRY_PAT = [
  ['ID', /indonesi|\bindo\b|인도네시아|インドネシア|jakarta/i],
  ['KR', /korea|korean|한국|韓国|코리아|seoul|서울/i],
  ['JP', /japan|japanese|日本|일본|tokyo|東京/i],
  ['PH', /philippin|pinoy|filipino|manila|필리핀|フィリピン/i],
  ['VN', /vietnam|việt|viet nam|베트남|ベトナム/i],
  ['TH', /thailand|\bthai\b|ไทย|태국/i],
  ['MY', /malaysia|malaysian|말레이시아|マレーシア/i],
  ['BR', /brazil|brasil|brazilian|브라질|ブラジル/i],
  ['MX', /mexico|méxico|mexican|멕시코|メキシコ/i],
  ['US', /\busa\b|america|american|united states|미국|アメリカ/i],
  ['TW', /taiwan|台灣|台湾|대만/i],
  ['CN', /\bchina\b|chinese|中国|중국/i],
  ['IN', /\bindia\b|indian/i],
  ['RU', /russia|россия|러시아|ロシア/i],
  ['SG', /singapore|싱가포르|シンガポール/i],
  ['TR', /turkey|türkiye|turkish/i],
  ['ES', /\bspain\b|españa/i],
  ['AR', /argentin/i],
  ['CL', /\bchile\b/i],
  ['CO', /colombia/i],
  ['PE', /\bperu\b|perú/i],
  ['FR', /\bfrance\b|français/i],
  ['DE', /germany|deutschland/i],
  ['PL', /\bpoland\b|polska/i],
  ['GB', /\buk\b|england|britain/i],
  ['HK', /hong kong|香港/i],
];

const num = (s) => {
  if (!s) return 0;
  const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase()] ?? 1;
  return Math.round(parseFloat(m[1]) * mult);
};

const files = fs.readdirSync(RAW).filter((f) => /_(top|new)\.json$/.test(f));
const perVideo = {};
const T = { lang: {}, langW: {}, flag: {}, mention: {}, byOrder: { top: {}, new: {} } };
const bump = (o, k, n = 1) => { o[k] = (o[k] ?? 0) + n; };

for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  const m = f.replace('.json', '').match(/^(.*)_(top|new)$/);
  const [, name, order] = m;
  const pv = perVideo[name] ??= { title: j.meta.title, views: +(j.meta.views ?? 0), n: 0, lang: {} };
  for (const c of j.comments) {
    const txt = c.text ?? '';
    const lang = detect(txt);
    const likes = num(c.likes);
    pv.n++; bump(pv.lang, lang);
    bump(T.lang, lang); bump(T.langW, lang, 1 + likes); bump(T.byOrder[order], lang);
    for (const fl of txt.match(FLAG) ?? []) bump(T.flag, flagToCC(fl));
    for (const [cc, re] of COUNTRY_PAT) if (re.test(txt)) bump(T.mention, cc);
  }
}

// --- 再生数加重: 各動画の言語構成を、その動画の再生数で重み付けして合算する ---
// コメント数は動画ごとに揃えて取得しているため、単純合算だと小規模動画を過大評価してしまう。
const weighted = {};
let viewsTotal = 0;
for (const v of Object.values(perVideo)) {
  const tot = Object.values(v.lang).reduce((a, b) => a + b, 0);
  if (!tot || !v.views) continue;
  viewsTotal += v.views;
  for (const [l, c] of Object.entries(v.lang)) bump(weighted, l, (c / tot) * v.views);
}
T.viewWeighted = weighted;
T.viewsTotal = viewsTotal;

fs.writeFileSync('data/analysis.json', JSON.stringify({ generatedAt: new Date().toISOString(), totals: T, perVideo }, null, 1));

const show = (o, label, n = 18) => {
  const tot = Object.values(o).reduce((a, b) => a + b, 0);
  console.log(`\n--- ${label} (計 ${tot.toLocaleString()}) ---`);
  Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)
    .forEach(([k, v]) => console.log(`${k.padEnd(11)}${String(v).padStart(8)}  ${((v / tot) * 100).toFixed(1).padStart(5)}%`));
};
show(T.lang, '(A) 言語分布 / コメント数ベース（動画あたり均等サンプル）');
show(T.viewWeighted, `(A0) 言語分布 / 再生数加重（=実リスナー構成の推定, 総${(T.viewsTotal/1e6).toFixed(1)}M再生）`);
show(T.langW, '(A2) 言語分布 / いいね加重');
show(T.byOrder.top, '(A3) 人気順コメント（=支持が集まった層）');
show(T.byOrder.new, '(A4) 新着順コメント（=直近の流入層）');
show(T.flag, '(B) 国旗絵文字', 15);
show(T.mention, '(C) 国名メンション', 15);

console.log('\n--- 動画別 上位言語 ---');
for (const [k, v] of Object.entries(perVideo).sort((a, b) => b[1].views - a[1].views)) {
  const top = Object.entries(v.lang).sort((a, b) => b[1] - a[1]).filter(([l]) => !['unknown','emoji_only'].includes(l)).slice(0, 4);
  const tot = Object.values(v.lang).reduce((a, b) => a + b, 0);
  console.log(`${k.padEnd(20)} ${String(v.views).padStart(9)}再生  ${top.map(([l, c]) => `${l}:${((c / tot) * 100).toFixed(0)}%`).join('  ')}`);
}
