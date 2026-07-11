# Claude Code スキル集

Claude Code で使うパーソナル自動化スキルを置いているリポジトリです。

| スキル | 何をする |
| --- | --- |
| `/iphone-notes` | iPhone のメモ App のデータを**全件**読み込み、「直感カルテ」(AI 自己解剖レポート) を生成 |
| `/tiktok-report` | TikTok アカウントの指標・コメントを収集してレポート |

---

## iPhone メモ → 直感カルテ (`/iphone-notes`)

話題になった [ゆとり社長の AI 活用術「AI 自己解剖 / 直感カルテ」](https://x.com/terada_masanobu/status/2075337311726752218)
の調整版です。元のプランは **Pinterest に直感で保存した画像**を AI に
読み込ませて「自分が何に惹かれるか」を言語化しますが、Pinterest をあまり
使っていない場合はデータが足りません。そこでこの版では、代わりに
**iPhone のメモ App にあるデータ全件**を素材にします。メモ (アイデア・
欲しいもの・悩み・下書き・リスト・引用) は無意識の関心がそのまま堆積した
データなので、同じ「自己解剖」がそのまま成立します。

### プランの全体像

1. **メモを取り出す** — 下の 3 ルートのどれか 1 つ
2. **全件取り込み・正規化** — `data/notes/` に JSONL / CSV / Markdown として整理
3. **直感カルテの生成** — 繰り返し現れるテーマ / 好み・美意識の言語化 /
   無意識の欲求 / 今の気分と悩み / 避けている課題 / 進むべき方向 を、
   メモからの根拠 (引用・件数) 付きで `reports/self/<日付>-kartei.md` に出力
4. **(任意) 補強** — 元メソッドと同じく、Spotify の最近聴いている音楽、
   Google カレンダーの最近の予定、本人が話す「今の悩み・仕事のテーマ」を
   加えると精度が上がります
5. **(任意) ビジュアル化** — カルテの内容を Canva で 1 枚のボードに変換

### メモの取り出し方 (3 ルート、どれか 1 つ)

**ルート A: Gmail 同期 — おすすめ。iPhone だけで完結**

1. iPhone の 設定 → アプリ → メール → メールアカウント → Gmail アカウント
   を追加 (追加済みならタップ) → **「メモ」を ON**
2. メモ App を開くと「GMAIL」セクションが現れる
3. iCloud 側の各フォルダで 右上 ⋯ → 「メモを選択」→「すべて選択」→
   「移動」→ GMAIL の Notes フォルダへ
4. 移動したメモは Gmail に **`Notes` ラベル**として同期される →
   Claude が Gmail 連携で直接読み込みます (ファイル操作は不要)

注意: ロック付き・添付 (写真/手書き) 付きのメモは移動できないことが
あります。それらはルート B で拾うか、少数なら共有シートで個別に
テキスト化して `notes_inbox/` へ。

**ルート B: Mac で一括書き出し — 添付付き・件数が多い場合に確実**

同じ iCloud アカウントの Mac で:

```bash
osascript .claude/skills/iphone-notes/scripts/export_notes_mac.applescript ~/Desktop/notes_export
```

メモ 1 件 = HTML 1 ファイルで書き出されます (ロック付きはスキップ)。
出てきたファイルを `notes_inbox/` に置くか、Google Drive にアップして
「Drive の◯◯フォルダから読み込んで」と伝えてください。

**ルート C: 手持ちのエクスポートを置くだけ**

`.txt` / `.md` / `.html` / `.enex` / `.eml` のファイルを `notes_inbox/` に
置く (サブフォルダ可)。Google Drive 経由でも OK。

### 使い方

Claude Code 上でこう言うだけです:

```
iPhoneのメモを全部読み込んで、直感カルテを作って
```

または明示的に `/iphone-notes`。取り込み後、
`reports/self/<日付>-kartei.md` にレポートが生成され、チャットに要約が
届きます。

### プライバシー

- `notes_inbox/` と `data/notes/` は **gitignore 済み** — 生のメモが
  リポジトリにコミットされることはありません。
- カルテ (`reports/self/`) も個人的な内容を含むため、コミットするかは
  毎回確認されます。
- メモの内容が外部サービスに送られるのは、明示的に頼んだ場合
  (Drive アップロードや Canva ビジュアル化など) だけです。

---

## TikTok アナリティクス レポート (`/tiktok-report`)

特定の TikTok アカウントを定期的にチェックし、動画ごとの指標 (再生数・
いいね・コメント・シェア・**保存数**) と、集まっているコメントを収集して、
**リポジトリ内のデータ**と**見やすい Google スプレッドシート**にレポート
するためのツールです。手動で実行でき、実行するたびに履歴が蓄積され、
前回との差分 (フォロワー増減など) もレポートされます。

### 使い方

```
@tiktok のレポートを出して
```

または明示的にスキルを呼ぶ場合:

```
/tiktok-report tiktok
```

Claude が次を自動で行います:

1. Playwright で対象アカウントをクロール (再生数・いいね・コメント・シェア・保存数 + 上位コメント)
2. `reports/<handle>/` にデータを書き出し
   - `metrics.csv` — 動画ごとの指標
   - `comments.csv` — 上位コメント
   - `account_history.csv` — 実行ごとに 1 行追記される時系列データ
   - `<日付>.md` — 前回比のトレンド付き 読みやすいレポート
   - `raw/<日付>.json` — 生データ
3. `metrics.csv` / `comments.csv` を **Google スプレッドシート**としてアップロード (リンクを共有)
4. チャットに要約 (アカウントの傾向・トップ動画・注目コメント・シート リンク)

### 前提・注意

- **ネットワーク:** `tiktok.com` への通信が必要です。ネットワークポリシーで
  TikTok がブロックされている環境では取得できません (その場合はブロックされて
  いない環境で実行してください)。
- **bot 対策:** TikTok は自動アクセスを制限します。取得に失敗する・件数が少ない
  場合は再実行してください。ログイン済みブラウザの Cookie 文字列を環境変数
  `TIKTOK_COOKIE` に設定すると成功率が上がります。
- **手動実行:** 現状は手動実行のスキルです。毎日の自動実行にしたい場合は、
  同じコマンドを定期実行トリガー (scheduled trigger) に組み込めます。ご希望が
  あれば設定します。

---

## 構成

```
.claude/skills/
├── iphone-notes/
│   ├── SKILL.md                       # Claude 向けの実行手順 + 直感カルテのプロンプト
│   └── scripts/
│       ├── normalize_notes.mjs        # 書き出しファイル → JSONL / CSV / Markdown (依存なし)
│       └── export_notes_mac.applescript  # Mac 用 一括書き出し (メモ → HTML)
└── tiktok-report/
    ├── SKILL.md              # Claude 向けの実行手順
    ├── package.json          # playwright 依存
    └── scripts/
        ├── scrape.mjs        # TikTok クローラ (Playwright)
        └── build_report.mjs  # 生データ → CSV / Markdown / 時系列

notes_inbox/              # メモの持ち込み場所 (中身は gitignore)
data/notes/               # 正規化されたメモ (gitignore)
reports/                  # 生成物 (TikTok レポート、直感カルテ)
```

詳細は各スキルの `SKILL.md` を参照してください。
