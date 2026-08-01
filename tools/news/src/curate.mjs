import Anthropic from '@anthropic-ai/sdk';

/**
 * 収集した記事とアーティスト指標を Claude に渡し、
 * 「読む価値のあるものだけ」を選んで日本語で要約させる。
 *
 * ANTHROPIC_API_KEY が無い / API が失敗した場合は null を返し、
 * 呼び出し側は素のRSS見出しだけでレポートを作る（配信は止めない）。
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const MAX_ITEMS_PER_CATEGORY = Number(process.env.NEWS_MAX_ITEMS_PER_CATEGORY || 5);

export function curationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildSchema(categoryKeys) {
  return {
    type: 'object',
    properties: {
      brief: {
        type: 'string',
        description: '今日おさえておくべきことを3〜4文で。忙しい朝に最初に読む段落。',
      },
      anomaly_note: {
        type: 'string',
        description:
          '担当アーティストの指標について、注目すべき動きとその解釈を2〜4文で。異常値が無ければ「特筆すべき変動なし」と書く。指標が未設定なら空文字。',
      },
      items: {
        type: 'array',
        description: `選定した記事。カテゴリごとに最大${MAX_ITEMS_PER_CATEGORY}件まで。`,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '入力で与えた記事IDをそのまま返す' },
            category: { type: 'string', enum: categoryKeys },
            headline_ja: { type: 'string', description: '日本語の見出し（40字以内）' },
            summary_ja: { type: 'string', description: '要約2〜3文。固有名詞と数字を落とさない。' },
            why_ja: {
              type: 'string',
              description: 'ソニーミュージックの担当者にとっての意味を1文で。',
            },
            importance: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          },
          required: ['id', 'category', 'headline_ja', 'summary_ja', 'why_ja', 'importance'],
          additionalProperties: false,
        },
      },
    },
    required: ['brief', 'anomaly_note', 'items'],
    additionalProperties: false,
  };
}

const SYSTEM = `あなたは日本の大手音楽会社（ソニーミュージック）で働く担当者のために、毎朝のニュースブリーフを作る編集者です。

読み手のプロフィール:
- 担当アーティストのプロモーションとデジタルマーケティングを見ている
- 最優先の関心は「担当アーティストまわりの異常値」— UGCの盛り上がり、ストリーミングのスパイク、SNSエンゲージの変化
- 次いで 音楽業界・エンタメ / SNS・動画トレンド / AI・テクノロジー

編集方針:
- 重要度の低い記事は容赦なく落とす。件数を埋めるために弱いネタを入れない。
- 数字・固有名詞・日付は落とさない。曖昧な言い換えをしない。
- 「なぜ重要か」は読み手の仕事（アーティストのプロモーション、SNS施策、レーベル業務）に接続して書く。一般論を書かない。
- プレスリリースの言い換えや、同じ話題の重複を避ける。同じ出来事を報じた記事が複数あれば最も情報量の多い1本だけを選ぶ。
- 日本語で書く。英語記事も日本語に要約する。`;

/**
 * @param {object} input
 * @param {Array} input.categories  [{key, label, articles: [...]}]
 * @param {string} input.artistSummary  アーティスト指標のテキスト要約
 * @param {string} input.dateLabel
 */
export async function curate({ categories, artistSummary, dateLabel }) {
  if (!curationConfigured()) return null;

  const client = new Anthropic();
  const categoryKeys = categories.map((c) => c.key);
  const schema = buildSchema(categoryKeys);

  // 記事に ID を振ってプロンプトに渡す
  const indexed = [];
  const lines = [];
  for (const category of categories) {
    lines.push(`\n## カテゴリ: ${category.label} (category="${category.key}")`);
    if (category.articles.length === 0) {
      lines.push('（該当期間の記事なし）');
      continue;
    }
    category.articles.forEach((article, i) => {
      const id = `${category.key}-${i + 1}`;
      indexed.push({ id, article });
      const when = article.published ? article.published.toISOString() : '日時不明';
      const body = article.summary ? article.summary.slice(0, 600) : '（本文なし）';
      lines.push(
        `\n[${id}] ${article.title}\n  媒体: ${article.source} / ${when}\n  概要: ${body}`,
      );
    });
  }

  const userPrompt = `${dateLabel} のニュースブリーフを作ってください。

# 担当アーティストの指標（今朝の自動計測）
${artistSummary || '（アーティスト指標は未設定です。anomaly_note は空文字にしてください。）'}

# 候補記事
${lines.join('\n')}

# 指示
1. brief: 今日おさえるべきことを3〜4文で。担当アーティストに動きがあればそれを最初に書く。
2. anomaly_note: 上の指標のうち注目すべき動きを解釈する。z値が2を超えているものは必ず触れる。異常が無ければ「特筆すべき変動なし」と明記する。
3. items: カテゴリごとに最大${MAX_ITEMS_PER_CATEGORY}件まで選ぶ。重要なものが少なければ少なくてよい（0件でもよい）。id は上の [xxx] をそのまま使う。`;

  const params = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: process.env.ANTHROPIC_EFFORT || 'high',
      format: { type: 'json_schema', schema },
    },
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const response = await callWithFallback(client, params);
  if (!response) return null;

  if (response.stop_reason === 'refusal') {
    console.warn('[curate] モデルが応答を拒否しました:', response.stop_details?.category ?? '理由不明');
    return null;
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    console.warn('[curate] テキストブロックが返りませんでした');
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    console.warn('[curate] JSON の解釈に失敗しました:', err.message);
    return null;
  }

  const byId = new Map(indexed.map((e) => [e.id, e.article]));
  const items = (parsed.items ?? [])
    .filter((item) => byId.has(item.id))
    .map((item) => ({ ...item, article: byId.get(item.id) }));

  return {
    brief: parsed.brief ?? '',
    anomalyNote: parsed.anomaly_note ?? '',
    items,
    usage: response.usage ?? null,
    model: response.model ?? MODEL,
  };
}

/**
 * Claude Opus 5 は安全性分類器が要求を拒否することがある。
 * サーバーサイド fallback を有効にして呼び、beta が使えない環境では通常経路に落とす。
 */
async function callWithFallback(client, params) {
  try {
    return await client.beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    console.warn('[curate] fallback 付きの呼び出しに失敗、通常経路で再試行します:', err.message);
  }

  try {
    return await client.messages.create(params);
  } catch (err) {
    console.warn('[curate] Claude API の呼び出しに失敗しました:', err.message);
    return null;
  }
}
