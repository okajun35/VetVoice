/**
 * Extractor component
 * Feature: vet-voice-medical-record
 * Task 10.1
 *
 * Extracts structured JSON (ExtractedJSON) from expanded veterinary text
 * using Amazon Bedrock Converse API.
 *
 * LLM: Amazon Nova Pro (default via model-config)
 * Dependencies: BedrockRuntimeClient (injected)
 *
 * Requirements: 5.1, 5.2, 5.3, 15.1
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { getModelConfig } from "./model-config";
import { parse, type ExtractedJSON } from "./parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractorInput {
  expanded_text: string;    // Output from Dictionary_Expander
  template_type?: string;   // Optional template hint
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default empty ExtractedJSON returned on any error (keeps pipeline alive) */
const EMPTY_EXTRACTED_JSON: ExtractedJSON = {
  vital: { temp_c: null },
  s: null,
  o: null,
  a: [],
  p: [],
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the extraction prompt for the given expanded text.
 * Instructs the model to output a JSON object matching ExtractedJSON schema.
 */
function buildPrompt(expandedText: string, templateType?: string): string {
  const templateHint = templateType
    ? `\nTemplate type: ${templateType}\n`
    : "";

  return `以下の獣医診療テキストから構造化JSONを抽出してください。${templateHint}
テキスト:
${expandedText}

以下のJSON形式で出力してください:
{
  "vital": { "temp_c": 体温（数値またはnull） },
  "s": "稟告（飼い主からの訴え）またはnull",
  "o": "所見（獣医師の診察結果）またはnull",
  "a": [{ "name": "病名・診断名" }],
  "p": [{ "name": "処置名または薬剤名", "type": "procedure"または"drug", "dosage": "用量またはnull" }]
}

抽出できない情報はnullまたは空配列にしてください。
JSONのみを出力し、説明文は不要です。`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract structured veterinary data from expanded text using Bedrock.
 *
 * @param input         Extractor input (expanded_text + optional template_type)
 * @param bedrockClient Injected BedrockRuntimeClient
 * @returns             Parsed ExtractedJSON, or empty default on any error
 */
export async function extract(
  input: ExtractorInput,
  bedrockClient: BedrockRuntimeClient,
): Promise<ExtractedJSON> {
  const config = getModelConfig("extractor");
  const prompt = buildPrompt(input.expanded_text, input.template_type);

  let rawText: string;

  try {
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

    rawText = response.output?.message?.content?.[0]?.text ?? "";
  } catch {
    // Bedrock API error — return empty default to keep pipeline alive
    return { ...EMPTY_EXTRACTED_JSON };
  }

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parseResult = parse(cleaned);
  if (!parseResult.success || !parseResult.data) {
    // Parse/validation error — return empty default
    return { ...EMPTY_EXTRACTED_JSON };
  }

  return parseResult.data;
}
