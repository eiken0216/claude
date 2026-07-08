#!/usr/bin/env python3
"""歌詞行×音声のビタビ強制アラインメント(本体)。
usage: python3 align_song.py [workdir]
入力: workdir/{post.npy, prior.npy, hmm_maps.pkl, phonemes.txt, lines.json}
出力: workdir/cue_times.json ([[start,end],...] 秒), workdir/align_report.json (信頼度)

方式:
- 行=1単語の直列グラフ。行間に「ガベージフィラー」(そのフレームの全状態最大スコア−λ)。
  間奏では正解音素が存在しない→フィラーが勝つ / 歌唱中は正解音素≒最大→歌詞が勝つ。
- λとmindur(状態あたり最小フレーム)を変えた複数設定で独立に解き、
  開始時刻±0.3s一致の多数決でコンセンサスを取る。
- 非コンセンサス行は、前後の確定行で挟んだ時間窓内だけで再アラインメント。
- 繰り返しセクション(サビ)の構造平行性チェック: 同一歌詞ブロック間で行間隔が
  大きく食い違う場合はレポートに warning を出す(人手確認対象)。

既知の弱点: サビの繰り返し・被り歌唱・ラップ調は誤りやすい(otukare実測で最大±8s)。
必ず align_report.json の low_confidence 行をユーザーに提示し、
日本語VTTドラフト→ユーザー修正→regen_from_ja.py の往復を前提とすること。"""
import numpy as np, pickle, json, sys, os
from itertools import combinations

wd = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
maps = pickle.load(open(wd+'hmm_maps.pkl', 'rb'))
phys, logi = maps['phys'], maps['logi']
post = np.load(wd+'post.npy'); prior = np.load(wd+'prior.npy')
obs_full = np.log(np.maximum(post, 1e-8)) - np.log(np.maximum(prior, 1e-12))[None, :]
row_max_full = obs_full.max(axis=1)
T_ALL = len(obs_full)
phon = [l.strip().split() for l in open(wd+'phonemes.txt') if l.strip()]
N_LINES = len(phon)

def posify(t):
    if len(t) == 1: return [t[0]+'_S']
    return [t[0]+'_B'] + [x+'_I' for x in t[1:-1]] + [t[-1]+'_E']

def tri_states(tokens):
    out = []
    for j, tk in enumerate(tokens):
        L = tokens[j-1] if j > 0 else 'sp'
        R = tokens[j+1] if j < len(tokens)-1 else 'sp'
        name = f'{L}-{tk}+{R}'
        ph = logi.get(name) or (name if name in phys else None)
        if ph is None:
            for alt in (f'sp-{tk}+{R}', f'{L}-{tk}+sp', tk):
                if alt in logi: ph = logi[alt]; break
                if alt in phys: ph = alt; break
        st = phys[ph]
        out.append(st[1:-1] if len(st) == 5 else st)
    return out

def align_window(t0, t1, idxs, lam, mindur=2):
    """時間窓[t0,t1]秒内で行idxsを順に強制アラインメント。{行: (start,end)}を返す"""
    f0, f1 = int(t0*100), min(int(t1*100), T_ALL)
    obs_all = obs_full[f0:f1]; row_max = row_max_full[f0:f1]
    T = f1 - f0
    emit_sid, node_line, self_ok, extra = [], [], [], {}
    line_first, line_last = {}, {}
    def add(sid, line, dup):
        ids = []
        for d in range(dup):
            emit_sid.append(sid); node_line.append(line); self_ok.append(d == dup-1)
            ids.append(len(emit_sid)-1)
        return ids
    f = add(-1, -1, 1)[0]; extra[f] = []
    prev_exits = [f, None]; start_nodes = [f]
    for k, i in enumerate(idxs):
        seq = tri_states(posify(phon[i]))
        first = prev = None
        for st in seq:
            for sid in st:
                ids = add(sid, i, mindur)
                if first is None: first = ids[0]
                if prev is not None: extra[ids[0]] = [prev]
                for a, b in zip(ids, ids[1:]): extra[b] = [a]
                prev = ids[-1]
        line_first[i], line_last[i] = first, prev
        ent = [prev_exits[0]] + ([prev_exits[1]] if prev_exits[1] is not None else [])
        extra[first] = extra.get(first, []) + ent
        if k == 0: start_nodes.append(first)
        f = add(-1, -1, 1)[0]; extra[f] = [prev]
        prev_exits = [f, prev]
    N = len(emit_sid)
    emit_sid = np.array(emit_sid); node_line = np.array(node_line); self_ok = np.array(self_ok)
    obs = np.where(emit_sid[None, :] >= 0,
                   obs_all[:, np.maximum(emit_sid, 0)], (row_max - lam)[:, None])
    NEG = -1e18
    score = np.full(N, NEG)
    for n in start_nodes: score[n] = obs[0, n]
    bp = np.zeros((T, N), dtype=np.int32); bp[0] = -1
    pred1 = np.full(N, -1, dtype=np.int32); multi = {}
    for n in range(N):
        e = extra.get(n, [])
        if len(e) == 1: pred1[n] = e[0]
        elif len(e) > 1: multi[n] = np.array(e, dtype=np.int32)
    mi = list(multi.items())
    ar = np.arange(N)
    for t in range(1, T):
        prev = score
        cand = np.where(pred1 >= 0, prev[np.maximum(pred1, 0)], NEG)
        src = pred1.copy()
        selfc = np.where(self_ok, prev, NEG)
        ts = selfc >= cand
        best = np.where(ts, selfc, cand); src = np.where(ts, ar, src)
        for n, e in mi:
            v = prev[e]; k2 = int(np.argmax(v))
            if v[k2] > best[n]: best[n] = v[k2]; src[n] = e[k2]
        score = best + obs[t]; bp[t] = src
    end = max([line_last[idxs[-1]], N-1], key=lambda n: score[n])
    path = np.zeros(T, dtype=np.int32); path[-1] = end
    for t in range(T-1, 0, -1): path[t-1] = bp[t, path[t]]
    pl = node_line[path]
    res = {}
    for i in idxs:
        fr = np.where(pl == i)[0]
        res[i] = (round(t0 + fr[0]*0.01, 3), round(t0 + (fr[-1]+1)*0.01, 3)) if len(fr) else None
    return res

CONFIGS = [(1.5, 2), (2.5, 2), (3.5, 2), (2.0, 3), (3.0, 3)]
TOL = 0.3
if __name__ == '__main__':
    all_idx = list(range(N_LINES))
    runs = []
    for lam, md in CONFIGS:
        r = align_window(0.0, T_ALL/100, all_idx, lam, md)
        runs.append(r)
        print(f'config lam={lam} mindur={md} done')
    def consensus(vals):
        med = float(np.median(vals))
        return med, sum(1 for v in vals if abs(v - med) <= TOL)
    starts, ends, conf = {}, {}, {}
    for i in all_idx:
        ss = [r[i][0] for r in runs if r.get(i)]
        ee = [r[i][1] for r in runs if r.get(i)]
        starts[i], cs = consensus(ss)
        ends[i], _ = consensus(ee)
        conf[i] = cs
    # 低信頼行を確定行アンカーで挟んだ窓で再アラインメント
    MAJ = (len(CONFIGS) // 2) + 1
    for _round in range(2):
        todo, i = [], 0
        while i < N_LINES:
            if conf[i] >= MAJ: i += 1; continue
            j = i
            while j < N_LINES and conf[j] < MAJ: j += 1
            t0 = ends[i-1] - 0.2 if i > 0 else 0.0
            t1 = starts[j] + 0.2 if j < N_LINES else T_ALL/100
            if t1 - t0 > 0.5: todo.append((list(range(i, j)), max(0, t0), t1))
            i = j
        if not todo: break
        for idxs, t0, t1 in todo:
            sub = [align_window(t0, t1, idxs, lam, md) for lam, md in CONFIGS[:3]]
            for i in idxs:
                ss = [r[i][0] for r in sub if r.get(i)]
                ee = [r[i][1] for r in sub if r.get(i)]
                if ss:
                    starts[i], cs = consensus(ss)
                    ends[i], _ = consensus(ee)
                    conf[i] = max(conf[i], cs)
    # 構造平行性チェック: 同一音素列の行ペアで、直後行との間隔を比較
    warns, warn_lines = [], set()
    sig = [' '.join(p) for p in phon]
    for a, b in combinations(range(N_LINES-1), 2):
        if sig[a] == sig[b] and sig[a+1] == sig[b+1]:
            da = starts[a+1] - starts[a]; db = starts[b+1] - starts[b]
            if abs(da - db) > 1.5:
                warns.append(f'行{a}→{a+1}の間隔{da:.1f}s と 行{b}→{b+1}の間隔{db:.1f}s が不一致(同一歌詞)')
                warn_lines |= {a, a+1, b, b+1}
    cues = [[starts[i], ends[i]] for i in all_idx]
    json.dump(cues, open(wd+'cue_times.json', 'w'))
    lines = json.load(open(wd+'lines.json'))
    low = [i for i in all_idx if conf[i] < MAJ]
    # check_lines = ユーザーに提示する要確認行(低信頼 + 構造警告に関与した行とその近傍)
    # 実測(otukare): 全設定一致でも8s誤る箇所があり、それは構造警告側だけが捕捉した
    check = sorted(set(low) | warn_lines)
    json.dump({'confidence': conf, 'low_confidence': low, 'structure_warnings': warns,
               'check_lines': check},
              open(wd+'align_report.json', 'w'), ensure_ascii=False, indent=1)
    for i in all_idx:
        flag = 'OK ' if conf[i] >= MAJ else 'LOW'
        print(f"{i:3} [{flag}] {starts[i]:8.2f}-{ends[i]:8.2f}  {lines[i]['ja'][:24]}")
    print('low_confidence:', low)
    for w in warns: print('WARN:', w)
    print('check_lines(要確認としてユーザーに提示):', check)
