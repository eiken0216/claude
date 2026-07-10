#!/usr/bin/env python3
"""cue_times.json + lyrics.json → 多言語VTT生成(ドラフト)。
usage: python3 make_vtt.py [workdir]
スタイル(ユーザー確定版から学習したルール):
- 全キュー完全連結: end_i = start_{i+1}。隙間を作らない。
  よって精度が重要なのは開始時刻のみ。
- 開始はビタビ検出オンセットより DISPLAY_LEAD 秒早める(歌い出しの直前に表示)。
- 間奏(検出オンセット間隔が大きい所)には装飾キューを挟んで埋める。
- 冒頭: 顔文字イントロ(曲テーマに合わせて変える)。末尾: Thank you for listening:))
- 装飾・顔文字は全言語共通(日本語のまま)。
出力は「ドラフト」。日本語版をユーザーに確認してもらい、修正版が返ってきたら
regen_from_ja.py で他言語を作り直すのが正規フロー。"""
import json, sys, os

wd = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
OUT = wd + 'vtt/'
os.makedirs(OUT, exist_ok=True)
cues = json.load(open(wd+'cue_times.json'))
rows = [ln for sec in json.load(open(wd+'lyrics.json')) for ln in sec]
DUR = float(open(wd+'duration.txt').read().strip()) if os.path.exists(wd+'duration.txt') else cues[-1][1] + 5

DISPLAY_LEAD = 0.25   # otukare実測: 自動検出開始は人手調整比で中央値+0.26s遅い
GAP_DECO = 5.0        # これ以上の間奏には装飾キューを挟む
INTRO = "- ̗̀( 🏖˶'ᵕ'˶) ̖́-　･*:.｡ ｡.:*･ﾟ✽.｡.:*"   # 曲テーマに合わせ差し替える
INTERLUDE = "✽.｡.:*・ﾟ･♪♪*:.｡ ｡.:*･ﾟ"               # 〃
THANKS = "Thank you for listening:))"

# 実際のシート列に合わせて調整(en_re等の確認用列は含めない)
LANGS = [('ja', 'ja'), ('romaji', 'ja-Latn'), ('en', 'en'), ('zh-TW', 'zh-TW'),
         ('zh-CN', 'zh-CN'), ('ko', 'ko'), ('id', 'id'), ('pt', 'pt'), ('th', 'th'), ('es', 'es')]

def ts(t):
    return f"{int(t//3600):02d}:{int(t%3600//60):02d}:{t%60:06.3f}"

starts = [max(0.5, s - DISPLAY_LEAD) for s, e in cues]
raw_ends = [e for s, e in cues]
n = len(cues)
for col, code in LANGS:
    if col not in rows[0]: continue
    out = [f"WEBVTT\nKind: captions\nLanguage: {code}\n"]
    out.append(f"{ts(0.0)} --> {ts(starts[0])}\n{INTRO}\n")
    for i in range(n):
        nxt = starts[i+1] if i+1 < n else None
        if nxt is not None and nxt - raw_ends[i] >= GAP_DECO:
            end = raw_ends[i] + 0.3
        else:
            end = nxt if nxt is not None else raw_ends[i] + 0.4
        out.append(f"{ts(starts[i])} --> {ts(end)}\n{rows[i][col].strip()}\n")
        if nxt is not None and nxt - raw_ends[i] >= GAP_DECO:
            out.append(f"{ts(end)} --> {ts(nxt)}\n{INTERLUDE}\n")
    last_end = raw_ends[-1] + 0.4
    out.append(f"{ts(last_end)} --> {ts(max(last_end+1, DUR-0.1))}\n{THANKS}\n")
    fn = OUT + f"captions_{code}.vtt"
    open(fn, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print('wrote', fn)
