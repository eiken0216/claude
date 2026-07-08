#!/usr/bin/env python3
"""dictation-kit DNN音響モデルの順伝播をNumPyで実行し、フレーム毎の状態事後確率を得る。
usage: python3 dnn_forward.py [workdir] [wav]
入力: workdir/song16k_d.wav, workdir/dictation-kit/model/dnn/
出力: workdir/post.npy (T×4874事後確率), workdir/prior.npy

HTKフロントエンド仕様 (config.lmfb): FBANK 40ch + Δ + ΔΔ = 120次元,
25ms窓/10msシフト, プリエンファシス0.97, ハミング窓, HTK式メルバンク(自然対数, floor=1.0),
normファイルの静的平均分散正規化, ±5フレームスプライス(1320次元)。
DNN: 隠れ7層×2048(シグモイド), 出力4874(ソフトマックス)。CPUで2-3分/3分曲。"""
import sys, os, re
import numpy as np, soundfile as sf

wd = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
wav = sys.argv[2] if len(sys.argv) > 2 else wd+'song16k_d.wav'
D = wd + 'dictation-kit/model/dnn/'

y, sr = sf.read(wav, dtype='float64')
assert sr == 16000
if y.max() <= 1.0: y = y * 32768.0
NFFT, WIN, HOP, NCH = 512, 400, 160, 40
nfr = 1 + (len(y) - WIN) // HOP
frames = np.lib.stride_tricks.sliding_window_view(y, WIN)[::HOP][:nfr].copy()
pre = np.empty_like(frames)
pre[:, 1:] = frames[:, 1:] - 0.97 * frames[:, :-1]
pre[:, 0] = frames[:, 0] * (1 - 0.97)
spec = np.abs(np.fft.rfft(pre * np.hamming(WIN), NFFT))
mel = lambda f: 2595.0 * np.log10(1.0 + f / 700.0)
imel = lambda m: 700.0 * (10 ** (m / 2595.0) - 1.0)
cent = imel(np.linspace(mel(0.0), mel(8000.0), NCH + 2))
bins = np.floor((NFFT + 1) * cent / 16000).astype(int)
fb = np.zeros((NCH, NFFT // 2 + 1))
for m in range(1, NCH + 1):
    l, c, r = bins[m-1], bins[m], bins[m+1]
    for k in range(l, c): fb[m-1, k] = (k - l) / max(1, c - l)
    for k in range(c, r): fb[m-1, k] = (r - k) / max(1, r - c)
lmfb = np.log(np.maximum(spec @ fb.T, 1.0))
def deltas(x, w=2):
    denom = 2 * sum(i * i for i in range(1, w + 1))
    xp = np.pad(x, ((w, w), (0, 0)), mode='edge')
    d = np.zeros_like(x)
    for th in range(1, w + 1):
        d += th * (xp[w+th:w+th+len(x)] - xp[w-th:w-th+len(x)])
    return d / denom
d1 = deltas(lmfb); d2 = deltas(d1)
feat = np.hstack([lmfb, d1, d2]).astype(np.float32)
nums = re.findall(r'[-+0-9.eE]+', open(D+'norm').read())
vals = [float(x) for x in nums if re.match(r'^[-+]?[0-9.]', x)]
mean = np.array(vals[1:121]); var = np.array(vals[122:242])
feat = ((feat - mean) / np.sqrt(var)).astype(np.float32)
W5 = 5
fp = np.pad(feat, ((W5, W5), (0, 0)), mode='edge')
X = np.hstack([fp[i:i+len(feat)] for i in range(2 * W5 + 1)]).astype(np.float32)
h = X
for l in range(1, 8):
    W = np.load(D+f'W_l{l}_f4.npy'); b = np.load(D+f'bias_l{l}_f4.npy').ravel()
    if W.shape[0] != h.shape[1]: W = W.T
    h = 1.0 / (1.0 + np.exp(-(h @ W + b)))
W = np.load(D+'W_output_f4.npy'); b = np.load(D+'bias_output_f4.npy').ravel()
if W.shape[0] != h.shape[1]: W = W.T
logits = h @ W + b
logits -= logits.max(axis=1, keepdims=True)
post = np.exp(logits); post /= post.sum(axis=1, keepdims=True)
np.save(wd+'post.npy', post.astype(np.float32))
prior = np.zeros(post.shape[1])
for line in open(D+'prior'):
    a, p = line.split(); prior[int(a)] = float(p)
np.save(wd+'prior.npy', prior)
print('posteriors', post.shape, 'mean max-post %.3f' % post.max(axis=1).mean())
