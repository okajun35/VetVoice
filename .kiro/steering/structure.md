# プロジェクト構造

## ディレクトリ構成

````
VetVoice/
├── amplify/                          # Amplify Gen 2 バックエンド定義
│   ├── auth/
│   │   └── resource.ts               # Cognito認証設定
│   ├── data/
│   │   ├── resource.ts               # GraphQLスキーマ + カスタムクエリ定義
│   │   ├── asset-paths.ts            # assets/generated の参照ユーティリティ
│   │   ├── run-pipeline.ts           # AIパイプライン Lambda handler
│   │   ├── generate-history-summary.ts # 診療履歴サマリー Lambda handler
│   │   └── handlers/                 # パイプラインコンポーネント（純粋ロジック）
│   │       ├── model-config.ts       # LLMモデル設定レイヤー
│   │       ├── transcriber.ts        # 音声→テキスト（Transcribe）
│   │       ├── dictionary-expander.ts # 略語辞書展開（ルールベース）
│   │       ├── extractor.ts          # 構造化JSON抽出（Bedrock）
│   │       ├── evaluation.ts         # 固定セット評価ロジック
│   │       ├── normalization-rules.ts # 抽出前後の正規化ルール
│   │       ├── parser.ts             # JSON解析・検証（純粋関数）
│   │       ├── master-matcher.ts     # マスタデータ照合（ファジーマッチ）
│   │       ├── template-selector.ts  # テンプレート自動選択
│   │       ├── soap-generator.ts     # SOAP生成（Bedrock）
│   │       ├── kyosai-generator.ts   # 家畜共済記録生成（Bedrock）
│   │       ├── visit-guard.ts        # visit入力の検証
│   │       └── generated/            # assets から生成される定数モジュール
│   ├── storage/
│   │   └── resource.ts               # S3ストレージ設定
│   └── backend.ts                    # バックエンド統合エントリポイント
│
├── src/                              # フロントエンド（React SPA）
│   ├── components/                   # UIコンポーネント
│   │   ├── QRScanner.tsx
│   │   ├── QRCodeDisplay.tsx
│   │   ├── CowListScreen.tsx
│   │   ├── CowDetailView.tsx
│   │   ├── CowRegistrationForm.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── PipelineEntryForm.tsx
│   │   ├── PipelineProgress.tsx
│   │   ├── VisitEditor.tsx
│   │   ├── VisitManager.tsx
│   │   ├── SOAPView.tsx
│   │   ├── KyosaiView.tsx
│   │   ├── HistorySummary.tsx
│   │   ├── TemplateSelector.tsx
│   │   ├── VisitReuse.tsx
│   │   ├── ThemeSwitcher.tsx
│   │   ├── DevEntryPoints.tsx
│   │   └── ui/                       # 共通UIプリミティブ
│   │       ├── Alert/
│   │       ├── Badge/
│   │       ├── Button/
│   │       ├── Card/
│   │       ├── Input/
│   │       ├── Modal/
│   │       ├── Select/
│   │       ├── Spinner/
│   │       ├── Tabs/
│   │       ├── Textarea/
│   │       └── Toast/
│   ├── hooks/                        # カスタムHooks
│   │   └── useTheme.ts
│   ├── lib/                          # フロントエンドユーティリティ
│   │   ├── cow-filter.ts             # 牛一覧検索
│   │   ├── offline-queue.ts          # オフラインキュー＆リトライ
│   │   ├── theme.ts                  # テーマ永続化・解決
│   │   ├── visit-reuse.ts            # Visit再利用ロジック
│   │   └── templates.ts              # テンプレート定義
│   ├── styles/                       # デザイントークンとグローバルCSS
│   │   ├── design-system.css
│   │   ├── reset.css
│   │   └── global.css
│   ├── types/
│   │   └── index.ts
│   ├── main.tsx
│   └── App.tsx
│
├── assets/                           # マスタデータ（Lambda内バンドル）
│   ├── byoumei.csv                   # 病名マスタ
│   ├── shinryo_tensu_master_flat.csv # 診療点数マスタ
│   ├── reference_compact.csv         # 薬剤マスタ
│   ├── shinryo_betsu_snow_regions.csv # 地域別診療データ
│   ├── dictionary.csv                # 略語・同義語辞書
│   ├── abbrev_lexicon.json           # 略語レキシコン正本
│   ├── normalization_rules.json      # 正規化ルール
│   ├── prompts/
│   │   └── extractor.txt             # Extractorプロンプト
│   ├── eval/
│   │   └── gold.v1.jsonl             # 固定評価データ
│   └── transcribe-vocabulary-vetvoice-ja-v1.txt
│                                       # Transcribe Custom Vocabulary
│
├── scripts/                          # 運用・評価・生成スクリプト
│   ├── generate-asset-modules.ts
│   ├── evaluate-pipeline.ts
│   ├── compare-extractor-models.ts
│   ├── extractor-kpi-weekly.ts
│   ├── create-soap-comparison-template.ts
│   ├── compare-soap-models.ts
│   ├── assist-soap-annotation.ts
│   ├── soap-quality-metrics.ts
│   ├── transcribe-vocab-update.sh
│   └── transcribe-vocab-status.sh
│
├── tests/                            # テストファイル
│   ├── unit/                         # ユニットテスト
│   │   ├── parser.test.ts
│   │   ├── dictionary-expander.test.ts
│   │   ├── extractor.test.ts
│   │   ├── master-matcher.test.ts
│   │   ├── model-config.test.ts
│   │   ├── transcriber.test.ts
│   │   ├── template-selector.test.ts
│   │   ├── generate-history-summary.test.ts
│   │   ├── evaluation.test.ts
│   │   ├── cow-registration-form.test.ts
│   │   ├── pipeline-entry-form.test.tsx
│   │   ├── ui-primitives.test.tsx
│   │   └── offline-queue.test.ts
│   ├── property/                     # プロパティベーステスト
│   │   ├── parser.property.test.ts
│   │   ├── dictionary-expander.property.test.ts
│   │   ├── extractor.property.test.ts
│   │   ├── master-matcher.property.test.ts
│   │   ├── template-selector.property.test.ts
│   │   ├── pipeline.property.test.ts
│   │   ├── pipeline-entry-form.property.test.tsx
│   │   ├── generate-history-summary.property.test.ts
│   │   ├── cow-filter.property.test.ts
│   │   ├── qr-code.property.test.ts
│   │   ├── ui-primitives.property.test.ts
│   │   └── visit-reuse.property.test.ts
│   ├── integration/                  # 統合テスト
│   │   └── pipeline.integration.test.ts
│   ├── helpers/                      # テストヘルパー・ジェネレータ
│   │   └── generators.ts             # fast-check用カスタムジェネレータ
│   └── setup.ts                      # Testing Library / matcher初期化
│
└── .kiro/
    ├── specs/                        # スペックファイル
    │   ├── vet-voice-medical-record/
    │   ├── pipeline-entry-form/
    │   ├── mobile-first-design/
    │   ├── ui-consistency-fix/
    │   └── cow-management-qr/
    └── steering/                     # ステアリングルール
````

## アーキテクチャ方針: 軽量ポート＆アダプター

フルのクリーンアーキテクチャ（Entity/UseCase/Interface Adapter/Framework の4層）は本PoCには過剰。
理由:
- Amplify Gen 2がフレームワーク層を強く規定している
- パイプラインの各コンポーネントが既に単一責任で分離されている
- PoCフェーズでビジネスロジックの変更頻度が高い

代わりに「軽量ポート＆アダプター」を採用:

````
┌─────────────────────────────────────────────┐
│  Lambda Handler（オーケストレーション層）      │
│  amplify/data/run-pipeline.ts               │
│  - エントリポイント制御                       │
│  - コンポーネント呼び出し順序                  │
│  - エラーハンドリング                         │
│  - DynamoDB保存                              │
└──────────────┬──────────────────────────────┘
               │ 呼び出し
┌──────────────▼──────────────────────────────┐
│  ハンドラー層（純粋ビジネスロジック）           │
│  amplify/data/handlers/*.ts                 │
│  - 入力→出力の純粋関数（テスト容易）           │
│  - AWS SDK依存は引数で注入                    │
│  - 型安全なインターフェース                    │
└──────────────┬──────────────────────────────┘
               │ 依存注入
┌──────────────▼──────────────────────────────┐
│  外部サービス層（AWS SDK）                    │
│  - Bedrock Runtime                          │
│  - Amazon Transcribe                        │
│  - DynamoDB                                 │
│  - テスト時はモックに差し替え                  │
└─────────────────────────────────────────────┘
````

### 分離の原則

1. `handlers/*.ts` は純粋関数として実装し、AWS SDKへの直接依存を避ける
2. AWS SDK呼び出しが必要な場合は、クライアントを引数として注入する
3. Lambda handler（`run-pipeline.ts`）がDI（依存注入）の責務を持つ
4. テスト時はモッククライアントを注入して純粋関数としてテスト

````typescript
// 良い例: AWS SDKクライアントを引数で受け取る
export async function extract(
  input: ExtractorInput,
  bedrockClient: BedrockRuntimeClient  // 注入
): Promise<ExtractedJSON> { ... }

// 悪い例: 関数内でクライアントを直接生成
export async function extract(input: ExtractorInput): Promise<ExtractedJSON> {
  const client = new BedrockRuntimeClient({});  // テスト困難
  // ...
}
````

## パイプラインフロー

````
QRスキャン → 音声入力 → Transcriber → Dictionary_Expander →
Extractor → Parser → Master_Matcher → Template_Selector →
[SOAP_Generator ∥ Kyosai_Generator] → 確認・編集 → 保存
````

各コンポーネントの特性:

| コンポーネント | LLM使用 | 決定論的 | テスト方針 |
|---------------|---------|---------|-----------|
| Parser | ✗ | ✓ | ユニット + プロパティ |
| Dictionary_Expander | ✗ | ✓ | ユニット + プロパティ |
| Master_Matcher | ✗ | ✓ | ユニット + プロパティ |
| Template_Selector | ✗ | ✓ | ユニット + プロパティ |
| Extractor | ✓ | ✗ | モック + スキーマ検証 |
| SOAP_Generator | ✓ | ✗ | モック + セクション検証 |
| Kyosai_Generator | ✓ | ✗ | モック + フィールド検証 |
| VisitReuse | ✗ | ✓ | ユニット + プロパティ |

## テスト戦略: TDD（t-wada流）

和田卓人氏のTDDアプローチに基づく:

### 基本サイクル: Red → Green → Refactor

1. Red: 失敗するテストを先に書く
2. Green: テストを通す最小限のコードを書く
3. Refactor: テストが通る状態を維持しながらリファクタリング

### テストの3層構造

````
┌─────────────────────────────────────┐
│  プロパティベーステスト (fast-check)   │  ← 普遍的な性質を検証
│  「すべての入力に対して成り立つ」       │
├─────────────────────────────────────┤
│  ユニットテスト (Vitest)              │  ← 具体的なケース・エッジケース
│  「この入力に対してこの出力」           │
├─────────────────────────────────────┤
│  統合テスト                           │  ← パイプライン全体の動作確認
│  「エントリポイントから保存まで」        │
└─────────────────────────────────────┘
````

### TDD実践ルール

1. テストファイルの配置:
   - ユニットテスト: `tests/unit/{component}.test.ts`
   - プロパティテスト: `tests/property/{component}.property.test.ts`
   - 統合テスト: `tests/integration/{flow}.integration.test.ts`

2. テストを先に書く:
   - 新しいコンポーネントを実装する前に、まずテストを書く
   - テストが失敗することを確認してから実装に入る

3. 小さなステップで進む:
   - 1つのテストケースを追加 → 実装 → リファクタリング
   - 一度に大きな変更をしない

4. プロパティベーステストの活用:
   - 決定論的コンポーネント（Parser, Dictionary_Expander, Master_Matcher等）は必ずプロパティテストを書く
   - fast-checkのジェネレータは `tests/helpers/generators.ts` に集約

### プロパティベーステスト（fast-check）のパターン

````typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Feature: vet-voice-medical-record, Property 1: Extracted_JSON ラウンドトリップ', () => {
  it('parse(stringify(obj)) は元のオブジェクトと等価', () => {
    fc.assert(
      fc.property(extractedJsonArb, (obj) => {
        const result = parse(stringify(obj));
        expect(result.success).toBe(true);
        expect(result.data).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });
});
````

### LLM利用コンポーネントのテスト方針

LLMの出力は非決定論的なため、以下の戦略を取る:

1. Bedrock APIをモックし、期待されるプロンプト送信を確認
2. モック出力に対してスキーマ準拠・必須フィールド含有をテスト
3. 実際のBedrock APIを使った統合テストは手動で実施

````typescript
// テスト時のBedrockモック例
const mockBedrockClient = {
  send: vi.fn().mockResolvedValue({
    body: new TextEncoder().encode(JSON.stringify({
      content: [{ text: JSON.stringify(mockExtractedJson) }]
    }))
  })
};

const result = await extract(input, mockBedrockClient as any);
expect(result.vital.temp_c).toBe(39.5);
````

### AWSインフラのテスト戦略

| レイヤー | テスト方法 |
|---------|-----------|
| Lambda handler | Vitest + イベントオブジェクトモック |
| Amplify Data (DynamoDB) | ローカルではDynamoDBモック使用 |
| AppSync カスタムクエリ | Lambda関数のロジックテストに集中 |
| Cognito認証 | テスト時はバイパスモック |
| Bedrock API | モッククライアント注入 |
| Transcribe API | モッククライアント注入 |
| S3 | モッククライアント注入 |

### マスタデータ

- `assets/byoumei.csv`: 病名マスタ（大分類・中分類・小分類・備考）
- `assets/shinryo_tensu_master_flat.csv`: 診療点数マスタ
- `assets/reference_compact.csv`: 薬剤マスタ
- `assets/dictionary.csv`: 略語・同義語辞書
- `assets/abbrev_lexicon.json`: 略語運用の正本
- `assets/normalization_rules.json`: 抽出前後の正規化ルール
- `assets/prompts/extractor.txt`: Extractorプロンプト
- `scripts/generate-asset-modules.ts` により generated module へ変換して利用する
