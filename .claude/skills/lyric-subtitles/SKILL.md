---
name: lyric-subtitles
description: >
  オリジナル楽曲のYouTube多言語字幕を作る2フェーズワークフロー。
  Phase 1: 歌詞スプレッドシート(原文ja)を受け取り多言語翻訳を返す。
  Phase 2: 音源/MVを受け取り、歌詞と音声を強制アラインメントしてVTT字幕一式を生成。
  トリガー例: 「歌詞を翻訳して」「スプシの歌詞を各国語に」「字幕データを作って」
  「YouTube字幕にして」「タイムコードをつけて」、歌詞シート+音源/動画ファイルの共有。
---

# YouTube多言語歌詞字幕ワークフロー

オリジナル曲の「歌詞翻訳 → 音声アラインメント → 多言語VTT」を行う。
実績: otukare(2:37, 56行, 9言語)。スクリプトは `scripts/` に完備。

## 全体フロー

```
Phase 1  歌詞スプシ受領 → 各国語翻訳 → シート形式で返却
Phase 2  音源/MV受領 → 強制アラインメント → 日本語VTTドラフト提出
往復     ユーザーが日本語VTTのタイムコード/内容を調整 → それをマスターに全言語再生成
```

**重要**: 自動アラインメントは完璧ではない(下記「精度の実測と教訓」)。
Phase 2の納品は必ず「日本語ドラフト → ユーザー確認 → regen_from_ja.py で全言語展開」
の往復を前提とし、低信頼行を明示して提出すること。

## Phase 1: 翻訳

1. スプレッドシート(Google Sheets)を Google Drive MCP か共有CSVで読む。
   otukareの列構成: セクション区切りあり、`ja`(原文) / `en` / `en_re`(英訳の
   確認用逆翻訳。**VTTにはしない**) / `romaji` / `zh-TW` / `zh-CN` / `ko` /
   `id` / `pt` / `th`。列は曲ごとに増減しうる。`kana`(読み)列があると
   Phase 2の精度と手間が大きく改善するので、翻訳時に追加を提案するとよい。
2. 翻訳スタイル:
   - オノマトペ(ぴかぴか等)は英語では音写+意訳の併用(例: "Pi pi pi, sparkling")。
   - 括弧のコーラス/エコー `(ぴかぴか)` は全言語で括弧のまま維持。
   - 装飾Unicode(𝑺𝒐𝒓𝒓𝒚...₊˚ˑ༄ 等)は雰囲気ごと保持または各言語で同等の装飾。
   - romajiはヘボン式。長音は歌唱に合わせ(こー→kō or koo、曲の表記感に合わせる)。
   - `kana`列はPhase 2のアラインメントに使う読み。歌唱通りの読みで
     (「私」を「わたし」等)。無ければ自動生成するがユーザー確認を推奨。
3. 返却はシートと同じ行構成で(CSVやシート追記)。行順・行数を絶対に変えない。

## Phase 2: 字幕生成(強制アラインメント)

### 環境の制約(リモート実行環境)

- HuggingFace / Google系DL / OpenSLR は**遮断**。Whisper/demucs等は使えない。
- **GitHubは通る**。Julius(音声認識)一式はGitHubから調達可能。
- Git LFSの大容量モデルは `media.githubusercontent.com/media/<org>/<repo>/master/<path>`
  直リンクで取る(raw.githubusercontent.com はLFSポインタしか返さない)。

### 手順

```bash
export WORKDIR=/path/to/work && cd $WORKDIR
bash  <skill>/scripts/setup_align.sh          # Julius build + モデルDL(初回5-10分)
python3 <skill>/scripts/prep_audio.py 音源.mp3  # →song16k_d.wav (MVはffmpegで音声抽出可)
# lyrics.json を用意: [[{"ja":..., "kana":..., "en":..., ...}, ...], ...] セクション別
python3 <skill>/scripts/make_kana.py          # かな読み→音素列(phonemes.txt)。出力を目視確認!
python3 <skill>/scripts/dnn_forward.py        # DNN事後確率(2-3分)
python3 <skill>/scripts/parse_hmm.py          # HMM状態マップ(初回のみ)
python3 <skill>/scripts/align_song.py         # ビタビ多数決アラインメント(10-15分)
python3 <skill>/scripts/make_vtt.py           # VTTドラフト生成(vtt/)
```

ユーザーから調整済み日本語VTTが返ってきたら:

```bash
python3 <skill>/scripts/regen_from_ja.py 調整済み.vtt   # 他言語を1msズレなく再生成
```

### 技術方式(要点)

- Julius dictation-kit のDNN音響モデル(FBANK120次元入力・出力4874状態)を
  **NumPyで直接順伝播**し、自前ビタビで歌詞行を強制アラインメント。
  (Julius本体はグラマー長制限・DNNの擬似状態問題で歌には直接使えない)
- 行間フィラーは「そのフレームの全状態最大スコア−λ」のガベージモデル。
  sp(無音)フィラーは音楽で機能しない(間奏を歌詞が飲み込む/逆に痩せる)。
- λ×最小継続長の5設定で独立に解き、開始±0.3s一致の多数決 → 低信頼行は
  確定行アンカーに挟まれた時間窓内で再アラインメント。
- GMM(segmentation-kit)は補助アンカー・クロスチェック用。単独では歌に弱い。

### 精度の実測と教訓 (otukare, ユーザー人手修正版との比較)

- 自動 vs 人手: 開始時刻の中央値 **+0.26s(遅れ)** → make_vtt.py は
  `DISPLAY_LEAD=0.25` で先行表示に補正済み(補正後0.3s以内が14→21行に改善)。
- 56行中(補正前): 0.5s以内 22行 / 1.0s以内 36行。**最悪は-8.2s**(間奏明けの
  掛け声「うー、いぇー！」〜サビ復帰の4行ブロックが8秒早く間奏に誤マッチ)。
- 誤りやすい: サビの繰り返し(同一歌詞が別の繰り返しに吸着)、間奏直後の短い
  掛け声、ウィスパー/英語行、ラップ調の高密度行。
- **全設定一致(コンセンサス)でも大きく誤ることがある**。otukareの-8s誤りは
  低信頼判定をすり抜けたが、構造平行性チェック(同一歌詞ペアの行間隔比較)の
  warning が該当ゾーンを正しく指した。`align_report.json` の `check_lines`
  (低信頼+構造警告関与行)を**ドラフト提出時に「要確認行」として必ず明示**する。

### VTTスタイル(ユーザー確定版から学習)

- **全キュー完全連結**(end = 次のstart)。隙間を作らない。精度は開始時刻が全て。
- 冒頭は顔文字イントロ(曲テーマに合わせる。例: 睡眠曲→`Zzzz｡.(⁎ꈍ﹃ꈍ⁎)･*`)。
- 間奏には装飾キュー(顔文字/アスキーアート/`( 'ω' و( و"♪`等)。ユーザーが
  後から挿入することも多い — 往復時に regen_from_ja.py がそのまま保持する。
- 短い掛け声は次行と結合キュー(1キュー2行)にすることがある。
- 末尾は `Thank you for listening:))`。装飾は**全言語共通で日本語のまま**。
- ヘッダ: `WEBVTT / Kind: captions / Language: <code>`。
  言語コード: ja, ja-Latn(romaji), en, zh-TW, zh-CN, ko, id, pt, th。
- ファイル名: `captions_<code>.vtt`。

### 納品

- VTT一式を SendUserFile で送付 + リポジトリにコミット(subtitles/<曲名>/)。
- ドラフト時は低信頼行リストを添えて「ここを確認してほしい」と伝える。
- 音源・モデル等の大容量ファイルはコミットしない。
