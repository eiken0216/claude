#!/bin/bash
# Julius強制アラインメント環境のセットアップ（冪等・再実行安全）
# 使い方: WORKDIR=/path/to/work bash setup_align.sh
# 所要: 初回 約5-10分(ビルド2分+モデルDL数分)。HuggingFace等は遮断環境でもGitHubは通る。
set -e
WORKDIR="${WORKDIR:-$PWD}"
cd "$WORKDIR"

pip install -q numpy scipy librosa soundfile pykakasi 2>&1 | tail -1 || true

# --- Julius本体（ソースからビルド。aptにはない） ---
# 主要パイプライン(DNN+自前ビタビ)はJulius不要。GMMクロスチェック等に使う場合のみ。
# SKIP_JULIUS=1 でスキップ可。
if [ -z "$SKIP_JULIUS" ] && [ ! -x "$WORKDIR/julius-bin/bin/julius" ]; then
  curl -sL https://github.com/julius-speech/julius/archive/refs/tags/v4.6.tar.gz | tar xz
  cd julius-4.6
  ./configure --prefix="$WORKDIR/julius-bin" --enable-words-int >/dev/null
  make -j4 >/dev/null 2>&1
  make install >/dev/null
  cd "$WORKDIR" && rm -rf julius-4.6
fi

# --- segmentation-kit（yomi2voca.pl かな→音素変換 + GMMモノフォンモデル） ---
if [ ! -d segmentation-kit ]; then
  curl -sL https://github.com/julius-speech/segmentation-kit/archive/refs/heads/master.tar.gz | tar xz
  mv segmentation-kit-master segmentation-kit
fi

# --- dictation-kit のDNNモデル（Git LFS: media.githubusercontent.com 直リンクが必須） ---
# 通常の raw.githubusercontent.com はLFSポインタしか返さないので注意
DK=dictation-kit/model/dnn
mkdir -p $DK
BASE="https://media.githubusercontent.com/media/julius-speech/dictation-kit/master/model/dnn"
for f in binhmm.SID logicalTri.bin hmmdefs.SID.gz logicalTri \
         W_l1_f4.npy W_l2_f4.npy W_l3_f4.npy W_l4_f4.npy W_l5_f4.npy W_l6_f4.npy W_l7_f4.npy \
         bias_l1_f4.npy bias_l2_f4.npy bias_l3_f4.npy bias_l4_f4.npy bias_l5_f4.npy bias_l6_f4.npy bias_l7_f4.npy \
         W_output_f4.npy bias_output_f4.npy; do
  [ -s "$DK/$f" ] || curl -sL --retry 3 "$BASE/$f" -o "$DK/$f" &
done
wait
# 小さい設定ファイルはrawでOK
RAWBASE="https://raw.githubusercontent.com/julius-speech/dictation-kit/master/model/dnn"
for f in norm prior config.lmfb; do
  [ -s "$DK/$f" ] || curl -sL "$RAWBASE/$f" -o "$DK/$f"
done
echo "setup done: $(du -sh dictation-kit | cut -f1) of models"
