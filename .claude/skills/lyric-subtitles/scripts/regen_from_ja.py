#!/usr/bin/env python3
"""ユーザー調整済みの日本語VTTをマスターに、他言語VTTを再生成する(往復フロー)。
usage: python3 regen_from_ja.py <調整済みja.vtt> [workdir]
- タイムコードは文字列のまま1msも変えずコピー。
- 歌詞行はlyrics.jsonのja列と順番マッチング(空白無視)。装飾行(顔文字等)はそのまま全言語へ。
- 1キュー複数行(結合キュー)対応: 行ごとに対応言語へ置換。
- ja本文がシートと部分一致しかしない場合はTEXT DIFF警告(シート側の更新漏れ検出)。"""
import json, re, sys, os

src = sys.argv[1]
wd = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
OUT = wd + 'vtt/'
os.makedirs(OUT, exist_ok=True)
rows = [ln for sec in json.load(open(wd+'lyrics.json')) for ln in sec]

raw = open(src, encoding='utf-8').read()
blocks = re.split(r'\n\n+', raw.strip())
header, cue_blocks = blocks[0], blocks[1:]
cues = [(b.split('\n')[0], b.split('\n')[1:]) for b in cue_blocks]

norm = lambda s: re.sub(r'\s+', '', s)
ja_norm = [norm(r['ja']) for r in rows]
ptr, cue_map = 0, []
for tline, texts in cues:
    m = []
    for t in texts:
        if ptr < len(rows) and norm(t) == ja_norm[ptr]:
            m.append(ptr); ptr += 1
        elif ptr < len(rows) and norm(t) and (norm(t) in ja_norm[ptr] or ja_norm[ptr] in norm(t)):
            print(f'TEXT DIFF 行{ptr}: sheet={rows[ptr]["ja"]!r} vtt={t!r}')
            m.append(ptr); ptr += 1
        else:
            m.append(None)
    cue_map.append(m)
assert ptr == len(rows), f'歌詞行マッチ {ptr}/{len(rows)} — jaシートとVTTの本文がずれている'

LANGS = [('romaji', 'ja-Latn'), ('en', 'en'), ('zh-TW', 'zh-TW'), ('zh-CN', 'zh-CN'),
         ('ko', 'ko'), ('id', 'id'), ('pt', 'pt'), ('th', 'th'), ('es', 'es')]
for col, code in LANGS:
    if col not in rows[0]: continue
    out = [re.sub(r'Language: \S+', f'Language: {code}', header)]
    for (tline, texts), m in zip(cues, cue_map):
        newtexts = [rows[r][col].strip() if r is not None else t for t, r in zip(texts, m)]
        out.append(tline + '\n' + '\n'.join(newtexts))
    open(OUT+f'captions_{code}.vtt', 'w', encoding='utf-8').write('\n\n'.join(out) + '\n')
    print('wrote', code)
open(OUT+'captions_ja.vtt', 'w', encoding='utf-8').write(raw if raw.endswith('\n') else raw + '\n')
print('wrote ja (verbatim)')
