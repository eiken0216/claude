# パン・シヒョク(방시혁) 調査ノート検証記録

- 検証日: 2026-08-03
- 検証者: 検証サブエージェント(WebFetch/検索エンジンHTML取得による実在照合)
- 対象: media-notes.md / works-notes.md
- 方法: (a) 両ノートの逐語引用を出典ページにWebFetchで当て、文字列の存在を1件ずつ照合。(b) 経歴・肩書・確度[高]主張の重要項目を独立ソースで事実確認。発見した不一致はノートを直接修正(修正箇所には「※2026-08-03検証」注記を付した)。
- 制約: 本セッションのWebSearch予算枯渇のため、途中からはWebFetch(Daum検索HTML直接取得を含む)のみで裏取りした。WebFetchは要約モデル経由のため、照合は「対象文字列の有無を問う」形式で実施。

---

## (a) 逐語引用スポットチェック(照合したソースページ26件・引用文字列 計118件)

| # | 出典ページ | 照合対象 | 結果 |
|---|---|---|---|
| 1 | ソウル経済 sedaily.com/NewsVIew/1VFGQC2Q9Q(ソウル大祝辞全文) | media引用1,2,10,11+works-A追加8件 | 全て実在確認。ただし works-A 2件に細部不一致(下記修正5,6)、works-A「남이 만들어 놓은 목표와 꿈...」は不存在(修正1) |
| 2 | YTN star _sn/0117_201902261645361882(祝辞全文) | media引用3〜8+「남이...」再照合 | media 6件全て実在。「남이 만들어 놓은 목표와 꿈을 무작정 따르는 것은 절대 하지마라」は不存在(近似原文のみ) |
| 3 | WikiTree articles/407012(祝辞) | media引用9、works-A「악습들」「상식이 통하고」「꼰대」「잘난 척」等5件 | 全て実在確認。꼰대引用の出典表記を訂正(修正11) |
| 4 | Newspim 20230315000310(관훈포럼) | media引用12,13 | 全て実在確認 |
| 5 | New Daily 2023031500249(관훈 기조연설 전문) | media引用14〜18(6文字列) | 全て実在確認 |
| 6 | 연합뉴스 일문일답 v.daum.net/v/20230315145628259(관훈 질의応答。韓経plus配信元) | works-B 9文字列 | 実在確認。ただし2件が不完全引用(修正7,8)、「낙수 효과」引用は「(지식재산권)」脱落(修正9)。※韓経plus原URLは有料化で本文冒頭のみ表示のため연합뉴스全文で照合し、works-notesに代替URLを追記 |
| 7 | SBS N1005403860(2019会社説明会) | media引用20〜23 | 全て実在確認(記事日付2019-08-21も確認) |
| 8 | NEWSIS NISX20210319_0001376348(HYBE社名変更) | media引用24〜26 | 全て実在確認(2021-03-19、NEW BRAND PRESENTATION確認) |
| 9 | 京郷新聞 201712101916001(2017高尺懇談会一問一答) | media引用27〜30 | 全て実在確認(2017-12-10、일문일답形式確認) |
| 10 | eToday 2298436(유퀴즈217回) | media引用31,32(4文字列) | 全て実在確認(2023-11-01放送・「運命的出会い」特集確認) |
| 11 | MyDaily 2023110204372564611(유퀴즈) | media引用33〜35(5文字列) | 全て実在確認(初回503→再取得で成功) |
| 12 | hankooki 114531(유퀴즈) | media引用36 | 見出しの直接引用表記として実在。本文はiMBC等で「비닐 바지 이슈로만」とも報道→注記追加(修正13) |
| 13 | btsinterviews(TIME 2019アーカイブ) | media引用37〜41+works-C1追加4件(計11文字列) | 全て実在確認。引用40後半・41は文頭省略のため原文どおり補完(修正3,4) |
| 14 | btsinterviews(Variety 2019アーカイブ) | media引用42〜44 | 全て実在確認(「Music and artist for healing」=ミッション言及も確認) |
| 15 | TIME 2022 time.com/6161246(2回照合) | media引用45〜48+works-C2 3件 | media 4件・works 2件実在。works-C2「...making a lot more money would be appropriate.」は原文に不存在→原文2文に差し替え(修正2) |
| 16 | Koreaboo(CNN 2023転載) | media引用49〜51 | 全て実在確認(CNN/Richard Quest帰属も記事内で確認。二次転載[確度中]の扱いは適切) |
| 17 | MBW(Bloomberg 2023転載) | media引用52〜56(8文字列) | 実在確認。引用54は「have I, or we as a company,」脱落→補完(修正5)。引用52は文が続くため省略記号追加 |
| 18 | NME(New Yorker 2024転載) | media引用57〜61(6文字列) | 全て実在確認(New Yorker帰属も記事内で確認) |
| 19 | NPR 2020-11-18 | media引用62〜69(8文字列)+works-E 2件 | 実在確認。ただし65(「the results」)、67(「in the world」脱落)、68(「the gratitude」「your fans」)の3件に細部不一致→原文どおり訂正(修正6) |
| 20 | NPR 2023-04-08 | media引用19+要旨2の数値(2%、危機診断、BTS休止要因) | 全て実在確認 |
| 21 | btsinterviews(weiv 2013アーカイブ) | media引用70〜73 | 全て実在確認 |
| 22 | btsinterviews(Xports 2016アーカイブ) | media引用74〜78 | 全て実在確認(原記事2016-11-17も確認) |
| 23 | Biz Tribune 312307(2024嘆願書) | media引用79〜82 | 全て実在確認(2024-05-19承認、ソウル中央地裁提出の탄원서報道と確認) |
| 24 | asiaartistawards 88700(嘆願書別報道) | works-F 3件 | 全て実在確認(2024-05-17付) |
| 25 | v.daum.net/v/20260409185002004(2026 Billboardアリラン) | media引用83〜85+「형이 이번에도 맞았던 것 같다」 | 全て実在確認(2026-04-09付、Billboardインタビュー由来と確認) |
| 26 | Daum検索HTML(補助) | 「방탄소년단이라는 IP...낙수 효과」の媒体横断確認 | 연합뉴스・韓国経済TV等のスニペットで同一文言を確認(원문에は「(지식재산권)」入り) |

**結論(a)**: media-notesの番号付き逐語85件は全て出典ページ上に実在(うち7件に冠詞・語句レベルの細部不一致→修正済)。works-notes固有の逐語33件中31件実在(2件は原文に存在せず→要旨降格・差し替え済)。**引用の捏造(全くの創作)は発見されなかった**が、「言い換えの逐語化」2件と細部不一致11件を修正した。

---

## (b) 経歴・肩書・確度[高]主張の事実確認(24項目)

| # | 主張 | 照合ソース | 結果 |
|---|---|---|---|
| 1 | 1972年8月9日ソウル生まれ | ko.wikipedia 방시혁 | 一致(「1972년 8월 9일...서울특별시」) |
| 2 | 京畿高→ソウル大美学科、「次席卒業と伝えられる」 | ko.wikipedia | 一致(「서울대학교 인문대학을 차석으로 졸업했다」の記載あり。確度[高(次席は中)]の判定は妥当) |
| 3 | 유재하음악경연대회 第6回銅賞・年度揺れ | ko.wikipedia再取得 | 現行版は「1995년...제6회...동상」+同年체크「인어 이야기」で作曲家デビュー。ノートの「1997년 제6회」内部矛盾記載を現行版準拠に更新(修正12) |
| 4 | 1997年頃JYPで박진영に見出され首席プロデューサー | ko.wikipedia(「1997년 박진영에 발탁돼...수석 프로듀서」) | 一致。※NPRは両者を「JYPは Park와 Bang의 협업」と対等に描写しており、「発掘された弟子」単純図式への注意は要旨として妥当 |
| 5 | Big Hit設立2005年2月1日 | en.wikipedia Hybe | 一致 |
| 6 | BTSデビュー2013年6月13日 | en.wikipedia Hybe / en.wikipedia BTS | 一致(M Countdown初舞台6/13) |
| 7 | KOSPI上場2020年10月15日 | en.wikipedia / NPR | 一致 |
| 8 | HYBE改称2021年3月(発表会3月19日) | en.wikipedia / NEWSIS | 一致 |
| 9 | 2021年7月CEO退任・理事会議長専任 | en.wikipedia(「resigned as CEO on July 1...replaced by Jiwon Park...retained his position as chairman」) | 一致 |
| 10 | Source Music買収2019年7月 | en.wikipedia | 一致 |
| 11 | Pledis買収2020年5月 | en.wikipedia | 一致 |
| 12 | KOZ買収2020年11月 | en.wikipedia | 一致 |
| 13 | Ithaca買収2021年4月・金額報道差 | en.wikipedia($1.05B) | 一致(ノートの「報道差あり・断定しない」注記は妥当) |
| 14 | ADOR設立2021年11月・민희진起用 | en.wikipedia(11月12日発表) | 一致 |
| 15 | SM持分14.8%取得(2023年2月)→3月撤退 | en.wikipedia | 一致(撤退表明は3/12のカカオ合意、売却実行は3月下旬) |
| 16 | QC Media Holdings買収時期 | en.wikipedia | **不一致**: ノートは「2024年2月」、en.wikipediaは2023年2月→訂正(修正10) |
| 17 | GLAM: 2012-07-16デビュー/Source共同/다희 이병헌恐喝(50억)/2015-01-15解散 | en.wikipedia Glam_(group) | 全て一致 |
| 18 | Weverse: 2019-06-10ローンチ/beNX開発/V LIVE譲受2021-01-27/V LIVE終了2023-01-01/SM入店2023-09-12/YG 2021/MAU1000万超(2023) | en.wikipedia Weverse | 全て一致 |
| 19 | HBSケース#520125(Elberse & Woodham、2020年6月、22頁) | store.hbr.org | 全て一致(2020年6月8日刊) |
| 20 | BTS全員再契約2023年9月 | en.wikipedia BTS(2023-09-20発表) | 一致 |
| 21 | 2018年10月早期再契約=「2025年まで」 | en.wikipedia BTS | **表記揺れ**: en.wikipediaは「through 2026」。ノートは断定回避に修正(修正14) |
| 22 | 2026-05-07 検察が拘束令状棄却(資本市場法違反容疑) | news.nate.com/view/20260508n26942 | 一致(2026-05-08付記事で棄却・容疑名・05-07日付を確認。係争中・有罪未確定の注記は維持) |
| 23 | 유퀴즈217回=2023-11-01(박진영同伴)/「2021年出演説は誤り」 | eToday / hankooki | 一致(両記事とも2023-11-01放送回として報道) |
| 24 | 受賞: 2017大統領表彰/2018 Billboard International Power Players(出典ko.wikipedia) | ko.wikipedia再取得 / NPR | 大統領表彰は一致。**Billboard選出はko.wikipedia現行版で確認できず**(現行版はイーデイリー文化大賞を記載)→出典帰属注記を追加、Billboard原記事の直接確認を要再調査とした(修正15) |

**結論(b)**: 24項目中21項目が独立ソースと一致。不一致は QC買収年(誤日付)、2018年再契約の満了年表記、Billboard 2018選出の出典帰属の3件で、いずれもノートを修正済。

---

## 修正内容一覧(ノートに適用済み)

### 重大(逐語不実在・誤日付・誤帰属): 6件
1. **[works-notes/A]** 「남이 만들어 놓은 목표와 꿈을 무작정 따르는 것은 절대 하지마라.」— wikitree/ソウル経済/YTN全文のいずれにも逐語不存在(要約記事の言い換えとみられる)→【要旨】に降格し、実在確認済みの近似原文(YTN)を明記。
2. **[works-notes/C2]** 「...making a lot more money would be appropriate.」— TIME 2022原文に不存在→原文の2文(「I personally think the music industry is losing quite a lot in the value chain」「I feel the music industry should be making a lot more money and their value as a service should be recognized more.」)に差し替え。
3. **[works-notes/17]** QC Media Holdings買収「2024年2月」→「2023年2月」に訂正(誤日付)。
4. **[media-notes/カタログ#28]** 2018年再契約「2025年までの」→「7年早期再契約(満了年は報道揺れ、en.wikipediaは through 2026)」に修正(誤日付疑い・断定回避)。
5. **[works-notes/受賞行]** 2018年Billboard「International Power Players」選出のko.wikipedia帰属が現行版で確認できず→出典再確認要の注記を追加(誤帰属)。
6. **[works-notes/A補足]** 꼰대前置き引用の出典表記「SBS/韓経報道群(検索結果)」→ wikitree全文で実在確認できたため出典をwikitreeに訂正(帰属の適正化)。

### 軽微(逐語の細部不一致の原文準拠訂正): 11件
7. [media 40] TIME 2019: 後半文の冒頭「When the artist wants to express something, I believe」を補完。
8. [media 41] TIME 2019: 「Because I believed it was right to make mistakes and learn from them, I built a relatively liberal trainee system.」に補完。
9. [media 52] MBW: 文が続くため末尾に省略記号を付加。
10. [media 54] MBW: 「have I, or we as a company, reached」を補完。
11. [media 65] NPR: 「about the results」に訂正。
12. [media 67] NPR: 末尾「in the world」を補完。
13. [media 68] NPR: 「the gratitude you feel for your fans」に訂正。
14. [works A] 「그래서 나의 분노는 현재진행형」→「그래서 저의 분노는 현재진행형입니다」(ソウル経済原文)。
15. [works A] 「부당하게 유통돼 부도덕한 사람들의 주머니를 채우는 수단이 되고 있습니다」に訂正。
16. [works B] 「지금은 라틴 시장에서 톱 티어 레이블들을 (인수를 위해) 보고 있다」に訂正。
17. [works B] 「이를 통해 미국 음악 시장 안에서 무시할 수 없는 존재가 되는 것이 우리의 첫 번째 목표다」に訂正+낙수효과引用に「(지식재산권)」補完。

### その他の追記
- [works B] 韓経plus一問一答の有料化を注記し、配信元・연합뉴스全文の代替URL(https://v.daum.net/v/20230315145628259)を追加。
- [media 36] 「비닐 바지만 알고 있었다」がhankooki見出しの直接引用表記である旨を注記(本文系は「비닐 바지 이슈로만」)。
- [works 経歴表] 유재하大会の年度をko.wikipedia現行版(1995年・第6回・銅賞)準拠に更新。

---

## 検証で問題なしと確認された主要ポイント(抜粋)

- ソウル大祝辞(2019-02-26)の中核引用群(「분노」「꿈은 없지만 불만은...」「묘비」等)は全文掲載記事(ソウル経済・YTN・wikitree)に逐語で実在。
- 관훈포럼(2023-03-15)の基調演説全文引用(53%減、サムスン/ヒョンデ比喩、Weverse等)はNew Daily全文に逐語で実在。質疑引用は연합뉴스一問一答で実在確認。
- 2024-05-17嘆願書引用(「인간의 악의」等)はBiz Tribune・asiaartistawardsの両報道に実在。係争中の一方当事者主張という中立性注記も維持されており適切。
- 「방탄이 나를 만들었다」定型句の一次出典未発見・使用回避の判断、「불만이 나의 원동력」が原文では「분노」である旨の帰属注意、NewJeans功績のミン・ヒジン帰属、社内文書問題の帰属限定、刑事手続の「容疑段階」注記は、いずれも今回の照合結果と整合し正当。
- メディア露出の希少性の記述(유퀴즈217回がほぼ唯一のバラエティ、SNS発信は確認できない等)は、水増しのない正直な記録と判断。

## 残課題(未照合のまま残る箇所)
- paywall/ブロックで一次照合不能: Bloomberg本誌、Billboard(米)、New Yorker本誌、Fast Company、CNBC、CNN本文(451)、Variety 2024、韓国経済2019(403)。ノート側で[確度中]・転載経由と明示済みのため現状維持で可。
- btsinterviews(ファン翻訳アーカイブ)は「アーカイブページ上の実在」まで確認。韓国語原記事(weiv/Xports)との突合は未実施(ノートに[確度中(ファン翻訳アーカイブ)]と明示済み)。
- 2018年Billboard International Power Players選出はBillboard原記事での直接確認が未了。
