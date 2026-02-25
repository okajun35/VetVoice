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
import { EXTRACTOR_PROMPT } from "./generated/extractor-prompt-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractorInput {
  expanded_text: string;    // Output from Dictionary_Expander
  template_type?: string;   // Optional template hint
  model_id_override?: string; // Optional runtime model override (dev/testing)
  strict_errors?: boolean; // If true, propagate extraction failures as errors
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
// Prompt loader & builder
// ---------------------------------------------------------------------------

/**
 * Module-level cache for the prompt template.
 * Uses the bundled EXTRACTOR_PROMPT constant from generated module.
 */
let promptTemplateCache: string | null = null;

/**
 * Load the extractor prompt template.
 * Uses the bundled constant from generated/extractor-prompt-data.ts.
 */
function loadPromptTemplate(): string {
  if (promptTemplateCache) return promptTemplateCache;
  promptTemplateCache = EXTRACTOR_PROMPT;
  return promptTemplateCache;
}

/**
 * Build the extraction prompt by substituting placeholders in the template.
 */
function buildPrompt(expandedText: string, templateType?: string): string {
  const template = loadPromptTemplate();
  const templateHint = templateType
    ? `\nテンプレートタイプ: ${templateType}\n`
    : "";

  return template
    .replace("{{TEMPLATE_HINT}}", templateHint)
    .replace("{{EXPANDED_TEXT}}", expandedText);
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
  const config = getModelConfig("extractor", false, input.model_id_override);
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
    console.log("Bedrock raw response length:", rawText.length, "text:", rawText.substring(0, 500));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Bedrock extract call failed:", err);
    if (input.strict_errors) {
      throw new Error(`Bedrock extract call failed: ${msg}`);
    }
    // Keep legacy behavior in non-strict mode.
    return { ...EMPTY_EXTRACTED_JSON };
  }

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parseResult = parse(cleaned);
  if (!parseResult.success || !parseResult.data) {
    // Parse/validation error — optionally propagate in strict mode
    console.error("Extractor parse failed:", { rawText: cleaned, errors: parseResult.errors });
    if (input.strict_errors) {
      const details = (parseResult.errors ?? []).join(", ");
      throw new Error(`Extractor parse failed${details ? `: ${details}` : ""}`);
    }
    return { ...EMPTY_EXTRACTED_JSON };
  }

  return parseResult.data;
}

/**
 * Reset prompt template cache (for testing purposes).
 * @internal
 */
export function resetPromptCache(): void {
  promptTemplateCache = null;
}
