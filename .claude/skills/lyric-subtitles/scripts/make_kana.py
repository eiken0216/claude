#!/usr/bin/env python3
"""歌詞(ja) → ひらがな読み(kana) → Julius音素列(phonemes.txt)。
usage: python3 make_kana.py [workdir]
入力: workdir/lyrics.json = [[{"ja": "...", ...}, ...], ...] (セクション別の行リスト)
      行に "kana" キーがあればそれを優先(シートに読み列がある場合)。
出力: workdir/lines.json (sec/idx/ja/kana), workdir/kana.txt, workdir/phonemes.txt

かな→音素は segmentation-kit/segment_julius.pl 内の変換テーブルを実行時に
パースして使う(bin/yomi2voca.pl 単体はエンコーディング問題で動かない)。

注意: pykakasiの読みは文脈で誤る(実例: 「今日は」→「こんにちは」)。
出力の読みを必ず目視確認し、OVERRIDESに追加して再実行すること。
英語行(例: Sorry, it's vacation time)は日本語風の読みを与える。"""
import json, re, sys, os
import pykakasi

wd = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
secs = json.load(open(wd+'lyrics.json'))
kks = pykakasi.kakasi()

OVERRIDES = {
    # 'ja原文(完全一致)': 'ひらがな読み'  — 例:
    # '今日は制服じゃなくて いいんじゃない？': 'きょうはせいふくじゃなくて いいんじゃない',
    # '※𝑺𝒐𝒓𝒓𝒚, 𝒊𝒕’𝒔 𝒗𝒂𝒄𝒂𝒕𝒊𝒐𝒏 𝒕𝒊𝒎𝒆...₊˚ˑ༄': 'そーりー いっつ ばけーしょん たいむ',
}

def to_kana(ja, given=None):
    if given: return given
    if ja in OVERRIDES: return OVERRIDES[ja]
    t = ja.replace('～', 'ー').replace('〜', 'ー')
    t = re.sub(r'[（(](.*?)[）)]', r' \1 ', t)   # コーラス括弧は本文として読む
    hira = ''.join(item['hira'] for item in kks.convert(t))
    hira = hira.replace('ゐ', 'い').replace('ゑ', 'え')
    hira = re.sub(r'[^ぁ-んー ]', '', hira)
    return re.sub(r' +', ' ', hira).strip()

# --- かな→音素テーブル (segment_julius.pl から抽出) ---
plsrc = open(wd+'segmentation-kit/segment_julius.pl', encoding='utf-8').read()
PAIRS = [(a, b) for a, b in re.findall(r's/(.+?)/ (.+?)/g;', plsrc)
         if re.match(r'^[ぁ-ゖー゛゜]+$', a)]
PAIRS.sort(key=lambda x: -len(x[0]))
assert len(PAIRS) > 200, 'segmentation-kit の変換テーブルが読めない'

def kana2phon(kana):
    out = []
    for word in kana.split():
        s = word
        for a, b in PAIRS:
            s = s.replace(a, ' ' + b)
        s = re.sub(r'\s+', ' ', s).strip()
        while 'ー' in s:                            # 長音: 直前母音の伸ばし → コロン
            s2 = re.sub(r'([aiueoAIUEO]):? ?ー', r'\1:', s, count=1)
            if s2 == s: s = s.replace('ー', '', 1)  # 先頭ー等は捨てる
            else: s = s2
        out.append(s)
    return '  '.join(out)

lines, phons = [], []
for si, sec in enumerate(secs):
    for li, ln in enumerate(sec):
        k = to_kana(ln['ja'], ln.get('kana'))
        lines.append({'sec': si, 'idx': li, 'ja': ln['ja'], 'kana': k})
        phons.append(kana2phon(k))
with open(wd+'kana.txt', 'w') as f:
    f.write('\n'.join(l['kana'] for l in lines) + '\n')
with open(wd+'phonemes.txt', 'w') as f:
    f.write('\n'.join(phons) + '\n')
json.dump(lines, open(wd+'lines.json', 'w'), ensure_ascii=False, indent=1)
bad = [i for i, p in enumerate(phons) if not p.strip() or 'ー' in p]
print('lines:', len(lines), ' 空/異常行:', bad if bad else 'なし')
for l, p in list(zip(lines, phons))[:6]:
    print(l['ja'][:20], '=>', l['kana'][:24], '=>', p[:40])
print('※ 読み(kana)を必ず目視確認。誤りはOVERRIDESに追加して再実行')
