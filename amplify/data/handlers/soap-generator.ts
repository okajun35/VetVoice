/**
 * SOAP_Generator component
 * Feature: vet-voice-medical-record
 * Task 12.1
 *
 * Generates SOAP-format veterinary medical record text from ExtractedJSON
 * using Amazon Bedrock Converse API.
 *
 * LLM: Amazon Nova Lite (default via model-config)
 * Dependencies: BedrockRuntimeClient (injected)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 15.2, 16.3
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

export interface SOAPInput {
  extracted_json: ExtractedJSON;
  template_type: TemplateType;
  cow_id?: string;
  visit_datetime?: string;
}

export interface SOAPOutput {
  soap_text: string;
  has_unconfirmed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default SOAP prompt when no template-specific prompt is available */
const DEFAULT_SOAP_PROMPT = `以下の診療の構造化データからSOAP形式の診療記録を日本語で生成してください。
Unconfirmedの候補には「（未確認）」と明示してください。

構造化データ:
{{extracted_json}}

SOAP形式で出力してください:
S（稟告）:
O（所見）:
A（評価・診断）:
P（計画・処置）:`;

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
 * Build the prompt string by substituting placeholders.
 */
function buildPrompt(
  template: string,
  extractedJson: ExtractedJSON,
  cowId?: string,
  visitDatetime?: string,
): string {
  let prompt = template;
  prompt = prompt.replace(
    "{{extracted_json}}",
    JSON.stringify(extractedJson, null, 2),
  );
  if (cowId !== undefined) {
    prompt = prompt.replace("{{cow_id}}", cowId);
  }
  if (visitDatetime !== undefined) {
    prompt = prompt.replace("{{visit_datetime}}", visitDatetime);
  }
  return prompt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a SOAP-format medical record text from ExtractedJSON using Bedrock.
 *
 * @param input         SOAPInput (extracted_json, template_type, optional cow_id/visit_datetime)
 * @param bedrockClient Injected BedrockRuntimeClient
 * @returns             SOAPOutput with soap_text and has_unconfirmed flag
 */
export async function generateSOAP(
  input: SOAPInput,
  bedrockClient: BedrockRuntimeClient,
): Promise<SOAPOutput> {
  const has_unconfirmed = checkHasUnconfirmed(input.extracted_json);

  // Resolve template: try requested type, fall back to general_soap
  const template =
    getTemplate(input.template_type) ?? getTemplate("general_soap");

  // Pick prompt: template-specific or default
  const promptTemplate =
    template?.soapPromptTemplate ?? DEFAULT_SOAP_PROMPT;

  const prompt = buildPrompt(
    promptTemplate,
    input.extracted_json,
    input.cow_id,
    input.visit_datetime,
  );

  const config = getModelConfig("soapGenerator");

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

  const soap_text = response.output?.message?.content?.[0]?.text ?? "";

  return { soap_text, has_unconfirmed };
}
