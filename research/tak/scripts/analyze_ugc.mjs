// UGC 候補を TAK 楽曲に絞り込み、投稿者の言語圏で分類する。
import fs from 'fs';
import { franc, francAll } from 'franc';

const vids = JSON.parse(fs.readFileSync('data/ugc_videos.json', 'utf8'));
const SONGS = /pppp|lemon\s*melon\s*cookie|レモンメロン|mochimochi|もちもち|孤独サイコ|psycho\s*mode|numb\s*numb|bavaroa|ババロア|mtmtm|dkbk|도깨비|逆さ月|reverse\s*moon|ちゅきちゅき|donatsu|lucky\s*doki|nnncn|ニャニャニャ/i;
const EXCLUDE = /^\[MV\]|^\[Teaser\]|^\[Preview\]|^\[Live Clip\]|^\[Remix\] TAK|^\[1hour\]/i;

const RE = { hangul:/[가-힣]/, kana:/[぀-ゟ゠-ヿ]/, han:/[一-鿿]/, thai:/[฀-๿]/, cyr:/[Ѐ-ӿ]/,
             viet:/[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/ };
const TRAD = /[說們這來時個為對後點麼樣過發現實聲學麗歡體萬雙靈嗎將樂灣華會]/;

function lang(s) {
  if (RE.hangul.test(s)) return 'ko';
  if (RE.kana.test(s))   return 'ja';
  if (RE.thai.test(s))   return 'th';
  if (RE.cyr.test(s))    return 'ru';
  if (RE.han.test(s))    return TRAD.test(s) ? 'zh-Hant' : 'zh-Hans';
  if (RE.viet.test(s))   return 'vi';
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (letters < 12) return 'en/other(短)';
  const all = francAll(s, { only: ['eng','ind','zlm','tgl','vie','spa','por','tur','fra','deu','ita','pol'], minLength: 10 });
  const scores = Object.fromEntries(all);
  const [top, sc] = all[0] ?? [];
  const map = { eng:'en', ind:'id', zlm:'id', tgl:'tl', vie:'vi', spa:'es', por:'pt', tur:'tr', fra:'fr', deu:'de', ita:'it', pol:'pl' };
  if (top !== 'eng' && map[top] && sc - (scores.eng ?? 0) >= 0.06) return map[top];
  return 'en/other(短)';
}

// 'numb numb' は ScHoolboy Q の別曲と衝突するため、TAK 側の文脈語を必須にする
const TAKCTX = /tak|ミク|miku|テト|teto|vocaloid|ボカロ|보컬로이드|미쿠|테토|doridori|하츠네/i;
const hit = vids.filter((v) => SONGS.test(v.title) && !EXCLUDE.test(v.title)
  && TAKCTX.test(`${v.title} ${v.channel}`));
const byLang = {}, byLangViews = {};
const num = (s) => parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0;
for (const v of hit) {
  const l = lang(`${v.title} ${v.channel}`);
  byLang[l] = (byLang[l] ?? 0) + 1;
  byLangViews[l] = (byLangViews[l] ?? 0) + num(v.views);
}
const show = (o, t) => {
  const tot = Object.values(o).reduce((a, b) => a + b, 0);
  console.log(`\n--- ${t} (計 ${tot.toLocaleString()}) ---`);
  Object.entries(o).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`${k.padEnd(14)}${String(v).padStart(9)}  ${((v / tot) * 100).toFixed(1).padStart(5)}%`));
};
console.log(`TAK楽曲のUGCと判定: ${hit.length} / ${vids.length} 本`);
show(byLang, 'UGC 本数の言語圏内訳');
show(byLangViews, 'UGC 再生数の言語圏内訳');

console.log('\n--- 再生数上位の UGC 20本 ---');
hit.sort((a, b) => num(b.views) - num(a.views)).slice(0, 20).forEach((v) =>
  console.log(`${(v.views || '').padStart(9)}  ${lang(`${v.title} ${v.channel}`).padEnd(12)} ${v.channel.slice(0, 22).padEnd(23)} ${v.title.slice(0, 62)}`));
fs.writeFileSync('data/ugc_analysis.json', JSON.stringify({ byLang, byLangViews, n: hit.length }, null, 1));
