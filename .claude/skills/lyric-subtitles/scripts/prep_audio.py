#!/usr/bin/env python3
"""音源準備: 入力(mp3/mp4/wav等) → 16kHzモノラルWAV(+微小ディザ)。
usage: python3 prep_audio.py <input_audio_or_video> [workdir]
動画はffmpegで音声抽出してから使ってもよいが、librosaが大抵直接読める。
出力: song16k.wav(素), song16k_d.wav(ディザ入り=アラインメント用), duration.txt
ディザは完全無音区間でJulius/特徴量計算が不安定になるのを防ぐため。"""
import sys, os
import numpy as np, librosa, soundfile as sf

src = sys.argv[1]
wd = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get('WORKDIR', '.')).rstrip('/') + '/'
y, sr = librosa.load(src, sr=16000, mono=True)
sf.write(wd+'song16k.wav', (y*32767).clip(-32768, 32767).astype('int16'), 16000, subtype='PCM_16')
rng = np.random.default_rng(7)
yi = (y*32767).astype(np.int32) + rng.integers(-2, 3, size=len(y))
sf.write(wd+'song16k_d.wav', np.clip(yi, -32768, 32767).astype('int16'), 16000, subtype='PCM_16')
open(wd+'duration.txt', 'w').write(f'{len(y)/16000:.3f}\n')
print('duration', round(len(y)/16000, 2), 's')
