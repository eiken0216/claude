# ミンヒジン(민희진)プロデュース力 研究 / 擬似ミンヒジンチャットボット プロジェクト

元SMアートディレクター・元ADOR代表・NewJeansプロデューサー(現 ooak/오케이 레코즈 창업자)であるミンヒジンの哲学・嗜好・戦略・作品・発言を一次資料から調査し、彼女の人格を模したチャットボットを構築するための研究リポジトリ。

## ディレクトリ構成

```
research/min-heejin/
├── README.md                 ← このファイル
├── sources/                  ← 一次資料
│   ├── motv-curator-part1-jzsvIQ4SsvE.md   MoTV 5월 큐레이터 민희진 1부 (2026-05, 59分)
│   ├── motv-curator-part2-ESruaSog1KA.md   同 2부 (61分)
│   ├── motv-curator-part3-WnwBXbcoh9w.md   同 3부 (57分)
│   └── newjeans-mv-data.md                 NewJeans全公式MVクレジット・再生数データ
├── analysis/                 ← MoTV 3部作の検証済み分析(計242項目、韓国語逐語引用付き)
│   ├── 01-motv-part1-findings.md
│   └── 02-motv-part2-3-findings.md
├── products/                 ← 作品研究(63作品、帰属確度・Web裏取り・独立検証付き)
│   ├── 01-sm-era.md                        SM時代 2002-2018(少女時代/SHINee/f(x)/EXO/Red Velvet)
│   ├── 02-ador-newjeans.md                 ADOR/NewJeans 2021-(デビュー戦略〜紛争期)
│   ├── 03-branding-systems.md              システムとしてのデザイン横断分析
│   └── 04-signature-patterns.md            キャリアを貫く10のシグネチャーパターン
├── interviews/               ← メディア露出総ざらい(2012-2026、76+エントリ)
│   ├── 00-media-catalog.md                 媒体別カタログ(逐語引用+実在検証付き)
│   └── 01-answers-anthology.md             本人の答案テーマ別アンソロジー+思想の変遷年表
└── persona/
    ├── minheejin-persona-v1.md             ペルソナ仕様書 v1(MoTVのみ)
    └── minheejin-persona-v2.md             ← 最新。作品+全メディア発言を統合した実装仕様
```

## 調査の方法論

各フェーズとも「並列分析エージェント → 独立検証エージェント(引用実在・話者帰属・帰属過大の照合)→ 欠落チェック」の多段構成。引用は「Web実取得ページからの逐語コピー」と「実在確認のみの要旨」を厳密に区別。作品の帰属は確度3段階(高/中/低)で管理し、「SMのヒット作=全部ミンヒジン」型の神話化を排除している。

## チャットボット実装の推奨構成

1. コア: `persona/minheejin-persona-v2.md`
2. 応答素材: `interviews/01-answers-anthology.md`(テーマ別答案)+ `analysis/01・02`(MoTV語録)
3. 作品の語り方: `products/04-signature-patterns.md` + 各作品ノート
4. 禁則: v2 §7(紛争フェーズ混同禁止・確度低作品の帰属禁止・捏造禁止)

## 残課題

- ユ・クイズ133回(2021-12)映像の全文書き起こし
- 현대카드 다빈치모텔 2024講演(134分)のフル分析
- 記者会見1次(2024-04-25、2時間超)の全文取り込み
- ~~カバレッジ欠落8件の回収~~ → 完了(`interviews/00-media-catalog.md` 追補参照。SFCC外信会見 2026-07、2024-04-22初動声明ほか。訂正2件: 本人初出廷は2025-09-11、2026-01-28会見は弁護士単独)
- WAF/403で逐語化できなかったソースの別環境での再取得(Hypebeast、ナタリー、allkpop、中央日報 等)
- システムプロンプト化と応答例による「本人らしさ」評価
