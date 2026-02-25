/**
 * Model configuration layer for LLM components.
 * Provides per-component model settings with environment variable override support.
 */

export interface ModelConfig {
  modelId: string;
  region: string;
  maxTokens: number;
  temperature: number;
}

export type ComponentName =
  | "extractor"
  | "soapGenerator"
  | "kyosaiGenerator"
  | "historySummary";

type ModelAliasMap = Record<string, string>;

// Default configs per component (Amazon Nova - recommended for competition)
const DEFAULT_CONFIGS: Record<ComponentName, ModelConfig> = {
  extractor: {
    modelId: "amazon.nova-pro-v1:0",
    region: "us-east-1",
    maxTokens: 4096,
    temperature: 0.1,
  },
  soapGenerator: {
    modelId: "amazon.nova-lite-v1:0",
    region: "us-east-1",
    maxTokens: 2048,
    temperature: 0.3,
  },
  kyosaiGenerator: {
    modelId: "amazon.nova-lite-v1:0",
    region: "us-east-1",
    maxTokens: 2048,
    temperature: 0.1,
  },
  historySummary: {
    modelId: "amazon.nova-micro-v1:0",
    region: "us-east-1",
    maxTokens: 1024,
    temperature: 0.3,
  },
};

// Fallback configs (Claude) when Nova precision is insufficient
const FALLBACK_CONFIGS: Record<ComponentName, ModelConfig> = {
  extractor: {
    modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",
    region: "us-east-1",
    maxTokens: 4096,
    temperature: 0.1,
  },
  soapGenerator: {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    region: "us-east-1",
    maxTokens: 2048,
    temperature: 0.3,
  },
  kyosaiGenerator: {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    region: "us-east-1",
    maxTokens: 2048,
    temperature: 0.1,
  },
  historySummary: {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    region: "us-east-1",
    maxTokens: 1024,
    temperature: 0.3,
  },
};

// Environment variable names for per-component model override
const ENV_VAR_NAMES: Record<ComponentName, string> = {
  extractor: "EXTRACTOR_MODEL_ID",
  soapGenerator: "SOAP_GENERATOR_MODEL_ID",
  kyosaiGenerator: "KYOSAI_GENERATOR_MODEL_ID",
  historySummary: "HISTORY_SUMMARY_MODEL_ID",
};

// Some Anthropic models in Bedrock must be invoked via inference profiles.
// Normalize known shorthand/base model IDs to profile IDs for compatibility.
function getModelAliasMap(): ModelAliasMap {
  return {
    "anthropic.claude-sonnet-4-6":
      process.env.CLAUDE_SONNET_4_6_INFERENCE_PROFILE_ID?.trim() ||
      "us.anthropic.claude-sonnet-4-6",
    "anthropic.claude-sonnet-4-20250514-v1:0":
      process.env.CLAUDE_SONNET_4_INFERENCE_PROFILE_ID?.trim() ||
      "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "anthropic.claude-haiku-4-5-20251001-v1:0":
      process.env.CLAUDE_HAIKU_4_5_INFERENCE_PROFILE_ID?.trim() ||
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "anthropic.claude-3-7-sonnet-20250219-v1:0":
      process.env.CLAUDE_3_7_SONNET_INFERENCE_PROFILE_ID?.trim() ||
      "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0":
      process.env.CLAUDE_3_5_HAIKU_INFERENCE_PROFILE_ID?.trim() ||
      "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  };
}

const MODEL_ID_PATTERN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[a-z0-9-]+)*$/i;
const INFERENCE_PROFILE_ARN_PATTERN =
  /^arn:aws[a-z-]*:bedrock:[a-z0-9-]+:\d{12}:inference-profile\/[A-Za-z0-9._:-]+$/;

export function normalizeModelId(modelId: string): string {
  const trimmed = modelId.trim();
  const aliases = getModelAliasMap();
  return aliases[trimmed] ?? trimmed;
}

export function isValidModelId(modelId: string): boolean {
  return (
    MODEL_ID_PATTERN.test(modelId) ||
    INFERENCE_PROFILE_ARN_PATTERN.test(modelId)
  );
}

/**
 * Returns the model configuration for the given component.
 * Priority: environment variable override > fallback config > default config.
 *
 * @param component - The pipeline component name
 * @param useFallback - If true, use Claude fallback instead of Nova default
 */
export function getModelConfig(
  component: ComponentName,
  useFallback = false,
  overrideModelId?: string
): ModelConfig {
  const base = useFallback
    ? FALLBACK_CONFIGS[component]
    : DEFAULT_CONFIGS[component];

  const directOverride = overrideModelId?.trim();
  if (directOverride) {
    const normalized = normalizeModelId(directOverride);
    if (!isValidModelId(normalized)) {
      throw new Error(
        `Invalid model ID format for ${component}: "${directOverride}".`
      );
    }
    return { ...base, modelId: normalized };
  }

  const envModelId = process.env[ENV_VAR_NAMES[component]];
  if (envModelId) {
    const normalized = normalizeModelId(envModelId);
    if (!isValidModelId(normalized)) {
      throw new Error(
        `Invalid model ID format in env ${ENV_VAR_NAMES[component]}: "${envModelId}".`
      );
    }
    return { ...base, modelId: normalized };
  }
  const normalizedDefault = normalizeModelId(base.modelId);
  if (!isValidModelId(normalizedDefault)) {
    throw new Error(
      `Invalid default model ID format for ${component}: "${base.modelId}".`
    );
  }
  return { ...base, modelId: normalizedDefault };
}

/**
 * Confidence threshold for master matching.
 * Candidates below this score are marked as Unconfirmed.
 * Centralized here for use across components.
 */
export const CONFIDENCE_THRESHOLD = 0.6;
