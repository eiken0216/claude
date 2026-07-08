#!/usr/bin/env python3
"""hmmdefs.SID.gz(HTKテキスト) と logicalTri から 音素名→DNN状態ID のマップを構築。
usage: python3 parse_hmm.py [workdir]
出力: workdir/hmm_maps.pkl  {'phys': {トライフォン名: 状態IDタプル}, 'logi': {論理名: 物理名}}
SID形式では各HMM状態が ~s "state_NNNN" でDNN出力インデックスを直接指す。"""
import gzip, re, pickle, sys, os

wd = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
D = wd + 'dictation-kit/model/dnn/'
phys = {}
name, states = None, []
with gzip.open(D+'hmmdefs.SID.gz', 'rt') as f:
    for line in f:
        m = re.match(r'~h "(.+)"', line)
        if m:
            if name and states: phys[name] = tuple(states)
            name, states = m.group(1), []
            continue
        m = re.search(r'~s "state_(\d+)"', line)
        if m and name: states.append(int(m.group(1)))
    if name and states: phys[name] = tuple(states)
logi = {}
with open(D+'logicalTri') as f:
    for line in f:
        parts = line.split()
        if len(parts) == 2: logi[parts[0]] = parts[1]
        elif len(parts) == 1: logi[parts[0]] = parts[0]
pickle.dump({'phys': phys, 'logi': logi}, open(wd+'hmm_maps.pkl', 'wb'))
print('physical HMMs:', len(phys), ' logical:', len(logi), ' sp:', phys.get('sp'), ' spn_S:', phys.get('spn_S'))
