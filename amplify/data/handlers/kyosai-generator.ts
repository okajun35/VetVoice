/**
 * Kyosai_Generator component
 * Feature: vet-voice-medical-record
 * Task 13.1
 *
 * Generates livestock mutual aid (家畜共済) record draft from ExtractedJSON
 * using Amazon Bedrock Converse API.
 *
 * LLM: Amazon Nova Lite (default via model-config)
 * Dependencies: BedrockRuntimeClient (injected)
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 15.3, 16.3
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { type ExtractedJSON } from "./parser";
import { type TemplateType, getTemplate } from "../../../src/lib/templates";
import { getModelConfig } from "./model-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KyosaiInput {
  extracted_json: ExtractedJSON;
  template_type: TemplateType;
  cow_id: string;
  visit_datetime: string;
  model_id_override?: string; // Optional runtime model override (dev/testing)
}

export interface KyosaiOutput {
  kyosai_text: string;
  has_unconfirmed: boolean;
  missing_fields: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default kyosai prompt when no template-specific prompt is available */
const DEFAULT_KYOSAI_PROMPT = `以下の診療の構造化データから家畜共済記録ドラフトを日本語で生成してください。
必須フィールド（牛ID、診療日、病名、処置内容、使用薬剤、診療点数）を含めてください。
Unconfirmedの候補は空欄とし「（手動入力が必要です）」と注記してください。

構造化データ:
{{extracted_json}}
牛ID: {{cow_id}}
診療日: {{visit_datetime}}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether any a[] or p[] item has status === "unconfirmed".
 */
function checkHasUnconfirmed(extractedJson: ExtractedJSON): boolean {
  const aHas = extractedJson.a.some((item) => item.status === "unconfirmed");
  const pHas = extractedJson.p.some((item) => item.status === "unconfirmed");
  return aHas || pHas;
}

/**
 * Collect missing required fields for kyosai record.
 * cow_id and visit_datetime are always present from input.
 * - "disease_name": a[].length === 0
 * - "disease_master_code": a[0].master_code is missing/undefined
 * - "procedure_or_drug": p[].length === 0
 */
function collectMissingFields(extractedJson: ExtractedJSON): string[] {
  const missing: string[] = [];

  if (extractedJson.a.length === 0) {
    missing.push("disease_name");
    missing.push("disease_master_code");
  } else if (!extractedJson.a[0].master_code) {
    missing.push("disease_master_code");
  }

  if (extractedJson.p.length === 0) {
    missing.push("procedure_or_drug");
  }

  return missing;
}

/**
 * Build the prompt string by substituting placeholders.
 */
function buildPrompt(
  template: string,
  extractedJson: ExtractedJSON,
  cowId: string,
  visitDatetime: string,
): string {
  let prompt = template;
  prompt = prompt.replace(
    "{{extracted_json}}",
    JSON.stringify(extractedJson, null, 2),
  );
  prompt = prompt.replace("{{cow_id}}", cowId);
  prompt = prompt.replace("{{visit_datetime}}", visitDatetime);
  return prompt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a livestock mutual aid (家畜共済) record draft from ExtractedJSON using Bedrock.
 *
 * @param input         KyosaiInput (extracted_json, template_type, cow_id, visit_datetime)
 * @param bedrockClient Injected BedrockRuntimeClient
 * @returns             KyosaiOutput with kyosai_text, has_unconfirmed flag, and missing_fields
 */
export async function generateKyosai(
  input: KyosaiInput,
  bedrockClient: BedrockRuntimeClient,
): Promise<KyosaiOutput> {
  const has_unconfirmed = checkHasUnconfirmed(input.extracted_json);
  const missing_fields = collectMissingFields(input.extracted_json);

  // Resolve template: try requested type, fall back to "kyosai"
  const template =
    getTemplate(input.template_type) ?? getTemplate("kyosai");

  // Pick prompt: template-specific kyosai prompt or default
  const promptTemplate =
    template?.kyosaiPromptTemplate ?? DEFAULT_KYOSAI_PROMPT;

  const prompt = buildPrompt(
    promptTemplate,
    input.extracted_json,
    input.cow_id,
    input.visit_datetime,
  );

  const config = getModelConfig("kyosaiGenerator", false, input.model_id_override);

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: config.modelId,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
  );

  const kyosai_text = response.output?.message?.content?.[0]?.text ?? "";

  return { kyosai_text, has_unconfirmed, missing_fields };
}
