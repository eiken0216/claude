# otukare サブスク（DSP）再生データ

「otukare」（楽音、2026-07-08 DSPリリース）のサブスク再生回数を蓄積し、
CSV とグラフにするための置き場です。

## 現状（2026-07-14 時点）

このセッション環境から SoundOn のダッシュボードには **直接アクセスできません**。

- `artist.soundon.global`（アーティスト管理画面）がこの環境のネットワーク
  ポリシーでブロックされている（本体サイト `www.soundon.global` は通る）
- SoundOn のログイン情報（メール/パスワード or Cookie）が環境に無い
- Gmail に SoundOn からのレポートメールも無し、Google Drive にも
  リリース（7/8）以降の再生データはまだ無い（`otukare/アナリティクス用` に
  あるスクリーンショットは 7/1〜7/5 時点＝リリース前の TikTok インサイト）

Spotify の公開再生数も代替として検討したが、ページは JS レンダリング必須で
ヘッドレスブラウザ通信がこの環境のプロキシで遮断されており、Spotify の
非公開 API は利用規約上の明示的な拒否を返すため使用しない。

## データの入れ方

`soundon_streams.csv` に 1 行 = 1 日 × 1 プラットフォーム（× 地域）で追記する:

```csv
date,platform,territory,streams
2026-07-08,Spotify,JP,1234
2026-07-08,Apple Music,JP,567
2026-07-09,Spotify,ALL,2345
```

- `platform`: Spotify / Apple Music / YouTube Music / LINE MUSIC など
  SoundOn インサイトの表記のまま
- `territory`: 国別が取れる場合は ISO 2 文字（JP, ID, PH…）、
  合計しか無い日は `ALL`
- プラットフォーム別が取れない日は `platform` を `ALL` にして合計だけでも可

元データの供給方法はどれでも OK:

1. SoundOn アプリ/管理画面のスクリーンショットを Drive の
   `otukare/アナリティクス用` に入れる（7/1 と同じ要領）→ Claude が読み取って追記
2. SoundOn のトラックインサイトから CSV エクスポートがあれば Drive へ
3. チャットに数字を貼る

データが入り次第、日次推移＋プラットフォーム別のグラフを生成します。
