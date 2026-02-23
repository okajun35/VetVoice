---
inclusion: fileMatch
fileMatchPattern: "amplify/data/**"
---

# パイプラインコンポーネント契約

本ドキュメントは `amplify/data/` 配下のファイル編集時に自動ロードされる。
各コンポーネントの入出力型定義とデータフロー契約を定義する。

## パイプラインデータフロー

```
音声 → Transcriber → Dictionary_Expander → Extractor → Parser →
Master_Matcher → Template_Selector → [SOAP_Generator ∥ Kyosai_Generator]
```

各コンポーネントの出力が次のコンポーネントの入力となる。型の整合性を常に維持すること。

## 中核データ型: ExtractedJSON

システム全体のSource of Truth。すべてのコンポーネントがこの型を中心に動作する。

```typescript
interface ExtractedJSON {
  vital: {
    temp_c: number | null;
  };
  s: string | null;                    // Subjective（稟告）
  o: string | null;                    // Objective（所見）
  a: Array<{
    name: string;                      // 病名
    confidence?: number;               // 0.0〜1.0
    master_code?: string;              // byoumei.csvのコード（例: "04-30"）
    status?: "confirmed" | "unconfirmed";
  }>;
  p: Array<{
    name: string;                      // 処置名 or 薬剤名
    type: "procedure" | "drug";
    dosage?: string;                   // 用量（薬剤の場合）
    confidence?: number;               // 0.0〜1.0
    master_code?: string;              // shinryo_tensu_master_flat.csvのコード（例: "S01-1"）
    status?: "confirmed" | "unconfirmed";
  }>;
}
```

## コンポーネント別契約

### Transcriber

```typescript
// 入力
interface TranscribeInput {
  audioKey: string;       // S3上の音声ファイルキー
  language: "ja-JP";
}

// 出力
interface TranscribeOutput {
  transcript_raw: string;
  confidence: number;
}

// LLM: 不使用（Amazon Transcribe API）
// 依存注入: TranscribeClient
```

### Dictionary_Expander

```typescript
// 入力
interface ExpanderInput {
  text: string;                    // transcript_raw
  dictionary: DictionaryEntry[];   // assets/dictionary.csv から読み込み
}

interface DictionaryEntry {
  canonical: string;               // 正式名称
  abbreviations: string[];         // 略語リスト（1-to-many）
  category?: string;
}

// 出力
interface ExpanderOutput {
  expanded_text: string;           // 展開済みテキスト
  expansions: Array<{
    original: string;              // 元の略語
    expanded: string;              // 展開後の正式名称
    position: number;              // テキスト内の位置
  }>;
}

// LLM: 不使用（ルールベース辞書ルックアップ）
// 決定論的: 同一入力 → 同一出力
// 依存注入: なし（純粋関数）
```

### Extractor

```typescript
// 入力
interface ExtractorInput {
  expanded_text: string;           // Dictionary_Expanderの出力
  template_type?: string;          // テンプレートヒント（任意）
}

// 出力: ExtractedJSON（上記の中核データ型）

// LLM: 使用（Bedrock — デフォルト: Nova Pro）
// 依存注入: BedrockRuntimeClient
```

### Parser

```typescript
// 入力/出力
interface ParseResult {
  success: boolean;
  data?: ExtractedJSON;
  errors?: string[];
}

function parse(jsonString: string): ParseResult;
function stringify(data: ExtractedJSON): string;

// ラウンドトリップ保証: parse(stringify(obj)) ≡ obj
// LLM: 不使用（純粋関数）
// 決定論的: 同一入力 → 同一出力
```

### Master_Matcher

```typescript
// 入力: ExtractedJSON.a[].name または ExtractedJSON.p[].name

// 出力
interface MatchCandidate {
  name: string;
  code: string;                    // マスタコード
  confidence: number;              // 0.0〜1.0
  master_source: "byoumei" | "shinryo_tensu";
  details: Record<string, string | number>;
}

interface MatchResult {
  query: string;
  candidates: MatchCandidate[];    // 上位3件
  top_confirmed: boolean;          // 最上位候補が閾値以上か
}

function matchDisease(name: string): MatchResult;
function matchProcedure(name: string): MatchResult;

// LLM: 不使用（編集距離 + トークンベース類似度）
// 決定論的: 同一入力 → 同一出力
// 依存注入: なし（CSVはコールドスタート時にメモリロード）
```

### Template_Selector

```typescript
type TemplateType = "general_soap" | "reproduction_soap" | "hoof_soap" | "kyosai";

// 入力: ExtractedJSON

// 出力
interface TemplateSelectionResult {
  selectedType: TemplateType;
  confidence: number;
  missingFields: string[];
}

function selectTemplate(extractedJson: ExtractedJSON): TemplateSelectionResult;
function validateRequiredFields(
  extractedJson: ExtractedJSON,
  template: TemplateDefinition
): string[];

// キーワードマッチング:
//   繁殖系 → reproduction_soap
//   蹄病系 → hoof_soap
//   該当なし → general_soap（デフォルト）
// LLM: 不使用
// 決定論的: 同一入力 → 同一出力
```

### SOAP_Generator

```typescript
// 入力
interface SOAPInput {
  extracted_json: ExtractedJSON;
  template_type: TemplateType;
}

// 出力
interface SOAPOutput {
  soap_text: string;               // S/O/A/Pセクション含有必須
  has_unconfirmed: boolean;        // Unconfirmed候補あり → 「未確認」表記
}

// LLM: 使用（Bedrock — デフォルト: Nova Lite）
// 依存注入: BedrockRuntimeClient
```

### Kyosai_Generator

```typescript
// 入力
interface KyosaiInput {
  extracted_json: ExtractedJSON;
  cow_id: string;
  visit_datetime: string;
  template_type: TemplateType;
}

// 出力
interface KyosaiOutput {
  kyosai_text: string;
  has_unconfirmed: boolean;        // Unconfirmed → 空欄 + 手動入力注記
  missing_fields: string[];        // 必須フィールド欠落リスト
}

// 必須フィールド: 牛ID、診療日、病名、処置内容、使用薬剤、診療点数
// LLM: 使用（Bedrock — デフォルト: Nova Lite）
// 依存注入: BedrockRuntimeClient
```

## オーケストレーター契約

```typescript
// amplify/data/run-pipeline.ts

type EntryPoint = "PRODUCTION" | "TEXT_INPUT" | "AUDIO_FILE" | "JSON_INPUT";

// 入力
interface PipelineInput {
  entry_point: EntryPoint;
  cow_id: string;
  audio_key?: string;
  transcript_text?: string;
  extracted_json?: ExtractedJSON;
  template_type?: string;
}

// 出力
interface PipelineOutput {
  visitId: string;
  cowId: string;
  transcriptRaw?: string;
  transcriptExpanded?: string;
  extractedJson?: ExtractedJSON;
  soapText?: string;
  kyosaiText?: string;
  templateType?: string;
  warnings: string[];
}
```

### エントリポイント別スキップ表

| エントリポイント | Transcriber | Dict_Expander | Extractor | Parser以降 |
|----------------|-------------|---------------|-----------|-----------|
| PRODUCTION | ✓ | ✓ | ✓ | ✓ |
| TEXT_INPUT | スキップ | ✓ | ✓ | ✓ |
| AUDIO_FILE | ✓ | ✓ | ✓ | ✓ |
| JSON_INPUT | スキップ | スキップ | スキップ | ✓ |

スキップされた段階以降は本番フローと同一ロジックで実行すること（Property 13）。

## 依存注入の原則

すべてのAWS SDK依存は引数で注入する:

```typescript
// 良い例
export async function extract(
  input: ExtractorInput,
  bedrockClient: BedrockRuntimeClient  // 注入
): Promise<ExtractedJSON> { ... }

// 悪い例
export async function extract(input: ExtractorInput): Promise<ExtractedJSON> {
  const client = new BedrockRuntimeClient({});  // テスト困難
}
```

Lambda handler（`run-pipeline.ts`）がDIの責務を持ち、テスト時はモッククライアントを注入する。

## Confidence閾値ルール

- 閾値以上 → `status: "confirmed"`
- 閾値未満 → `status: "unconfirmed"`
- SOAP生成時: Unconfirmed → 「未確認」表記
- 共済生成時: Unconfirmed → 空欄 + 手動入力注記
- 閾値の具体値は `model-config.ts` で設定
