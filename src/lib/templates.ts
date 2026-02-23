/**
 * Template definitions for VetVoice medical record system.
 * Shared between frontend (src/) and backend (amplify/data/handlers/).
 *
 * Requirement 16.1: Provides general_soap, reproduction_soap, hoof_soap, kyosai templates.
 */

// TemplateType: the four supported template types
export type TemplateType =
  | "general_soap"
  | "reproduction_soap"
  | "hoof_soap"
  | "kyosai";

// TemplateDefinition: full definition for a single template
export interface TemplateDefinition {
  type: TemplateType;
  /** Display label shown in UI */
  label: string;
  /**
   * Required field paths in ExtractedJSON.
   * Examples: "vital.temp_c", "s", "o", "a[0].name", "a[0].master_code"
   */
  requiredFields: string[];
  /**
   * Keywords used for automatic template selection.
   * Empty array means this template is the default (general_soap) or always generated (kyosai).
   */
  keywords: string[];
  /** Japanese prompt template string for SOAP generation (optional) */
  soapPromptTemplate?: string;
  /** Japanese prompt template string for kyosai generation (optional) */
  kyosaiPromptTemplate?: string;
}

// TEMPLATES: ordered array of all template definitions
// Order matters: more specific templates (reproduction, hoof) are checked before the default (general_soap)
export const TEMPLATES: TemplateDefinition[] = [
  {
    type: "reproduction_soap",
    label: "繁殖SOAP（妊娠鑑定・分娩）",
    requiredFields: ["vital.temp_c", "s", "o"],
    keywords: ["妊娠", "分娩", "繁殖", "発情", "授精", "妊娠鑑定", "子宮"],
    soapPromptTemplate: `以下の繁殖診療の構造化データからSOAP形式の診療記録を日本語で生成してください。
繁殖に関連する所見（妊娠の有無、胎子の状態、子宮の状態、発情周期など）を重点的に記載してください。
Unconfirmedの候補には「（未確認）」と明示してください。

構造化データ:
{{extracted_json}}

SOAP形式で出力してください:
S（稟告）:
O（所見）:
A（評価・診断）:
P（計画・処置）:`,
    kyosaiPromptTemplate: `以下の繁殖診療の構造化データから家畜共済記録ドラフトを日本語で生成してください。
必須フィールド（牛ID、診療日、病名、処置内容、使用薬剤、診療点数）を含めてください。
Unconfirmedの候補は空欄とし「（手動入力が必要です）」と注記してください。

構造化データ:
{{extracted_json}}
牛ID: {{cow_id}}
診療日: {{visit_datetime}}`,
  },
  {
    type: "hoof_soap",
    label: "蹄病SOAP",
    requiredFields: ["vital.temp_c", "o"],
    keywords: ["蹄", "跛行", "蹄病", "削蹄", "蹄底", "趾皮膚炎"],
    soapPromptTemplate: `以下の蹄病診療の構造化データからSOAP形式の診療記録を日本語で生成してください。
蹄に関連する所見（患肢、蹄の状態、跛行の程度、処置内容など）を重点的に記載してください。
Unconfirmedの候補には「（未確認）」と明示してください。

構造化データ:
{{extracted_json}}

SOAP形式で出力してください:
S（稟告）:
O（所見）:
A（評価・診断）:
P（計画・処置）:`,
    kyosaiPromptTemplate: `以下の蹄病診療の構造化データから家畜共済記録ドラフトを日本語で生成してください。
必須フィールド（牛ID、診療日、病名、処置内容、使用薬剤、診療点数）を含めてください。
Unconfirmedの候補は空欄とし「（手動入力が必要です）」と注記してください。

構造化データ:
{{extracted_json}}
牛ID: {{cow_id}}
診療日: {{visit_datetime}}`,
  },
  {
    type: "general_soap",
    label: "一般診療SOAP",
    requiredFields: ["vital.temp_c", "s", "o"],
    keywords: [], // default: selected when no specific keywords match
    soapPromptTemplate: `以下の診療の構造化データからSOAP形式の診療記録を日本語で生成してください。
Unconfirmedの候補には「（未確認）」と明示してください。

構造化データ:
{{extracted_json}}

SOAP形式で出力してください:
S（稟告）:
O（所見）:
A（評価・診断）:
P（計画・処置）:`,
    kyosaiPromptTemplate: `以下の診療の構造化データから家畜共済記録ドラフトを日本語で生成してください。
必須フィールド（牛ID、診療日、病名、処置内容、使用薬剤、診療点数）を含めてください。
Unconfirmedの候補は空欄とし「（手動入力が必要です）」と注記してください。

構造化データ:
{{extracted_json}}
牛ID: {{cow_id}}
診療日: {{visit_datetime}}`,
  },
  {
    type: "kyosai",
    label: "家畜共済テンプレート",
    // Kyosai requires confirmed master codes for disease and procedure
    requiredFields: [
      "a[0].name",
      "a[0].master_code",
      "p[0].name",
      "p[0].master_code",
    ],
    keywords: [], // always generated independently of SOAP template selection
    kyosaiPromptTemplate: `以下の診療の構造化データから家畜共済申請用の記録ドラフトを日本語で生成してください。
必須フィールド（牛ID、診療日、病名（マスタコード付き）、処置内容（マスタコード付き）、使用薬剤、診療点数（B種・A種）、診療点数合計）を含めてください。
Unconfirmedの候補は空欄とし「（手動入力が必要です）」と注記してください。
確定済みのマスタコードは必ず記載してください。

構造化データ:
{{extracted_json}}
牛ID: {{cow_id}}
診療日: {{visit_datetime}}`,
  },
];

/**
 * Look up a template definition by type.
 * Returns undefined if not found.
 */
export function getTemplate(type: TemplateType): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.type === type);
}
