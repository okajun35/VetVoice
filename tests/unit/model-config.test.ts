import { afterEach, describe, expect, it } from "vitest";
import { getModelConfig } from "../../amplify/data/handlers/model-config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("model-config compatibility and validation", () => {
  it("normalizes known Anthropic base model IDs to US inference profiles by default", () => {
    const cases: Array<[string, string]> = [
      ["anthropic.claude-sonnet-4-6", "us.anthropic.claude-sonnet-4-6"],
      [
        "anthropic.claude-sonnet-4-20250514-v1:0",
        "us.anthropic.claude-sonnet-4-20250514-v1:0",
      ],
      [
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      ],
      [
        "anthropic.claude-3-7-sonnet-20250219-v1:0",
        "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
      ],
      [
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      ],
    ];

    for (const [inputId, expectedId] of cases) {
      const config = getModelConfig("extractor", false, inputId);
      expect(config.modelId).toBe(expectedId);
    }
  });

  it("uses CLAUDE_SONNET_4_6_INFERENCE_PROFILE_ID when provided", () => {
    process.env.CLAUDE_SONNET_4_6_INFERENCE_PROFILE_ID =
      "global.anthropic.claude-sonnet-4-6";

    const config = getModelConfig(
      "extractor",
      false,
      "anthropic.claude-sonnet-4-6"
    );

    expect(config.modelId).toBe("global.anthropic.claude-sonnet-4-6");
  });

  it("uses env override for each compatible Anthropic model profile ID", () => {
    process.env.CLAUDE_SONNET_4_INFERENCE_PROFILE_ID =
      "global.anthropic.claude-sonnet-4-20250514-v1:0";
    process.env.CLAUDE_HAIKU_4_5_INFERENCE_PROFILE_ID =
      "global.anthropic.claude-haiku-4-5-20251001-v1:0";
    process.env.CLAUDE_3_7_SONNET_INFERENCE_PROFILE_ID =
      "global.anthropic.claude-3-7-sonnet-20250219-v1:0";
    process.env.CLAUDE_3_5_HAIKU_INFERENCE_PROFILE_ID =
      "global.anthropic.claude-3-5-haiku-20241022-v1:0";

    expect(
      getModelConfig(
        "extractor",
        false,
        "anthropic.claude-sonnet-4-20250514-v1:0"
      ).modelId
    ).toBe("global.anthropic.claude-sonnet-4-20250514-v1:0");
    expect(
      getModelConfig(
        "extractor",
        false,
        "anthropic.claude-haiku-4-5-20251001-v1:0"
      ).modelId
    ).toBe("global.anthropic.claude-haiku-4-5-20251001-v1:0");
    expect(
      getModelConfig(
        "extractor",
        false,
        "anthropic.claude-3-7-sonnet-20250219-v1:0"
      ).modelId
    ).toBe("global.anthropic.claude-3-7-sonnet-20250219-v1:0");
    expect(
      getModelConfig(
        "extractor",
        false,
        "anthropic.claude-3-5-haiku-20241022-v1:0"
      ).modelId
    ).toBe("global.anthropic.claude-3-5-haiku-20241022-v1:0");
  });

  it("throws for invalid override model ID format", () => {
    expect(() =>
      getModelConfig("extractor", false, "anthropic claude sonnet invalid")
    ).toThrow("Invalid model ID format");
  });
});
