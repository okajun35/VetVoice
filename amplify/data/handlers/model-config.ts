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
    return { ...base, modelId: directOverride };
  }

  const envModelId = process.env[ENV_VAR_NAMES[component]];
  if (envModelId) {
    return { ...base, modelId: envModelId };
  }

  return base;
}
