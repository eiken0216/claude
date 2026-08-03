---
title: "追加調査：ダンス発×海外コメント型 TikTok 候補（2026-07-26 第2弾）"
aliases:
  - "追加調査：ダンス発×海外コメント型 TikTok 候補（2026-07-26 第2弾）"
category: "リサーチ・分析"
project: "新人アーティスト発掘"
created: 2026-07-26
source_repo: eiken0216/claude
source_branch: claude/emerging-artist-accounts-search-mrh2wv
source_path: "reports/emerging-artists-dance-2026-07-26.md"
tags:
  - ai-reference
  - リサーチ-分析
  - 新人発掘
  - TikTok
  - ダンス
---

# 追加調査：ダンス発×海外コメント型 TikTok 候補（2026-07-26 第2弾）

ryudai / yuuna のような「ダンスで伸びて海外コメントが大量につく音楽系アカウント」に方向転換した回。
**第1弾で出したアカウントは全て除外**している。

## 基準（実測）

| アカウント | フォロワー | 最高再生 | 再生/フォロワー | 海外コメント率 |
|---|---|---|---|---|
| **@ryudai_a**（ご指定の基準） | 2,000,000 | 5,430万 | ×27.1 | **93.9%** |
| 楽音 -sasane（第1弾の基準） | 1,000,000 | 1,260万 | ×12.6 | 83.1% |

ryudai_a のほうが海外比率も再生/フォロワー比も高い。ダンス型のほうが言語の壁が無い分、
海外に抜けやすいという構造がはっきり出ている。以下はこの基準で並べたもの。

## 探索方法（第1弾と変えた点）

TikTok の検索APIは全滅（ログイン必須）だったため、**動画説明文の @メンションをたどる
BFSクロール**に切り替えた。ダンス勢はコラボで相互に @ を打つのでグラフが繋がる。
`@ryudai_a` を起点に、加えて YouTube をダンス系クエリ（日本語＋インドネシア語/タイ語/
スペイン語/ポルトガル語/韓国語/ベトナム語/中国語/ロシア語）で掘って概要欄から
TikTok ハンドルを逆引きし、合計 **456アカウント**をクロール・スクリーニングした。

---

## A. 最有力

| # | アカウント | 名前 | フォロワー | 最高再生 | 再生/フォロワー | 海外% | 言語分布 | メモ |
|---|---|---|---|---|---|---|---|---|
| 1 | [@robomon01](https://www.tiktok.com/@robomon01) | ロボモン | 516,900 | **1,680万** | **×32.5** | **93.9%** | en50 / fr15 / es8 / de4 … | 渋谷のストリートでロボットダンス。「世界一有名なパフォーマーを目指しています」。**認証なし・事務所表記なし**。ryudai_a とほぼ同じ海外比率を1/4のフォロワーで出している |
| 2 | [@tuna_killeer](https://www.tiktok.com/@tuna_killeer) | ツナ🐟Tuna | **31,500** | 180万 | **×57.1** | 69.4% | en25 / ru12 / es9 / pt7 | 踊ってみた×コスプレ、日英バイリンガル🇨🇦🇯🇵。lit.link＝自主運用。**規模が小さい分、伸びしろが一番大きい** |
| 3 | [@__nightmoon___](https://www.tiktok.com/@__nightmoon___) | るなち🔮🌙 | **15,900** | 571,000 | ×35.9 | 61.3% | en30 / ru4 | 「会える踊り手」。プロセカ系コスプレ踊ってみた。ニコ動にも投稿＝完全に個人 |
| 4 | [@hiromunieru](https://www.tiktok.com/@hiromunieru) | HIROMUNIERU | **6,144** | 120万 | **×195.3** | 47.4% | en16 / es5 / fr3 / ar1 | インド系。『RRR』Naatu Naatu ダンスカバーがヒット。**再生/フォロワー比が桁違い** |
| 5 | [@odooji](https://www.tiktok.com/@odooji) | ODOOJI | 96,800 | 163,700 | ×1.7 | 51.1% | id31 / en12 | 「普通の会社員だって舞いたい」。K-POPカバー中心でインドネシア勢が張り付いている |

## B. 規模は大きいが海外偏重が極端

| # | アカウント | 名前 | フォロワー | 最高再生 | 海外% | メモ |
|---|---|---|---|---|---|---|
| 6 | [@zerouchirestart](https://www.tiktok.com/@zerouchirestart) | ZERO-UCHI Restart | 5,100,000 | **5,110万** | **96.9%** | 日本の"ヲタ芸"パフォーマー。**ロシア語41%** という他に無い分布。自社ドメイン運用・認証済 |
| 7 | [@avantgardey_](https://www.tiktok.com/@avantgardey_) | アバンギャルディ | 2,300,000 | 780万 | 75.6% | ダンスチーム。認証済・既に大型 |
| 8 | [@shimamonx](https://www.tiktok.com/@shimamonx) | しまも | 1,700,000 | 776,800 | 72.7% | Piano Singer-songwriter。**ダンス経由で伸びて音楽に接続している型**。lnk.to 配信あり |
| 9 | [@tomiokaai](https://www.tiktok.com/@tomiokaai) | 冨岡 愛 | 408,100 | 690万 | 58.6% | コメントに「why isn't she famous yet」。ただしTVアニメEDテーマ担当＝既に流通あり |

## C. 参考

| アカウント | 名前 | フォロワー | 海外% | メモ |
|---|---|---|---|---|
| [@soulm8.jp](https://www.tiktok.com/@soulm8.jp) | キッズダンスコンテストSOULM8 | 15,800 | 43.0% | 最高710万再生（×449）。コンテスト運営アカウントなのでアーティストではないが、**出場キッズの発掘導線として価値がある** |
| [@animememekyoto](https://www.tiktok.com/@animememekyoto) | animememekyoto | 6,211 | 38.6% | 関西のサブカルイベント。ミク/テト踊ってみた |
| [@ryudaiyuuna](https://www.tiktok.com/@ryudaiyuuna) | ryuna | 26,600 | 41.9% | ryudai×yuuna のコラボ用サブアカウント |

## 除外

- **既に大手流通**: imase（ユニバーサル）、冨岡愛（アニメタイアップ）
- **日本人でない**: @miyusimatamiyu(ID)、@pns.96 / @hokuplg / @luceneplg / @zonaplg(TH)、
  @romy.sanchez、@portalcheer、@babyjam.jr、@maypiano(VN)
- **海外比率が低い（国内型）**: @0808sakura(26.3%)、@minami.0819(8.2%)、@ihararikka(2%)、
  @moca_2812(2%)、@o_menz(2.1%)、@egu_splosion(1.5%)、@kirari_1016_(0%)、
  @realakibaboys(0%)、@aimio_1017(1.4%)、@hana_brave_official(0%)、@love2chiitan(14.9%)

## 所感

第1弾（弾き語り・カバー系）より **明確に当たりが多い**。理由ははっきりしていて、
歌モノは歌詞の言語が壁になるが、ダンスは壁がないので海外比率が構造的に上がる。
一方でその分「音楽アーティストとしての出口」は弱くなるので、**@shimamonx のように
ダンス的な伸び方から音楽に接続している型**が、両取りできる本命だと思う。
@robomon01 と @tuna_killeer は規模と独立性のバランスが良く、接触するなら今。
