/**
 * Kyosai_Generator component unit tests
 * Feature: vet-voice-medical-record
 * Task 13.2
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, vi } from "vitest";
import { generateKyosai } from "../../amplify/data/handlers/kyosai-generator";
import type { KyosaiInput } from "../../amplify/data/handlers/kyosai-generator";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockBedrock(responseText: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: { message: { content: [{ text: responseText }] } },
    }),
  } as unknown as BedrockRuntimeClient;
}

function makeFailingBedrock(error: Error = new Error("Bedrock error")) {
  return {
    send: vi.fn().mockRejectedValue(error),
  } as unknown as BedrockRuntimeClient;
}

function makeJson(overrides: Partial<ExtractedJSON> = {}): ExtractedJSON {
  return {
    vital: { temp_c: 39.5 },
    s: "食欲不振",
    o: "体温39.5℃、第一胃蠕動音減弱",
    a: [{ name: "第四胃変位", master_code: "04-30", status: "confirmed" as const }],
    p: [{ name: "ブドウ糖静注500ml", type: "drug" as const, status: "confirmed" as const }],
    ...overrides,
  };
}

const BASE_INPUT: KyosaiInput = {
  extracted_json: makeJson(),
  template_type: "kyosai",
  cow_id: "1234567890",
  visit_datetime: "2024-01-15T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe("Kyosai_Generator: generateKyosai", () => {
  it("returns kyosai_text from Bedrock response", async () => {
    const kyosaiText = "家畜共済記録\n牛ID: 1234567890\n診療日: 2024-01-15\n病名: 第四胃変位";
    const client = makeMockBedrock(kyosaiText);

    const result = await generateKyosai(BASE_INPUT, client);

    expect(result.kyosai_text).toBe(kyosaiText);
  });

  it("has_unconfirmed is false when all items are confirmed", async () => {
    const client = makeMockBedrock("共済ドラフト");
    const input: KyosaiInput = {
      ...BASE_INPUT,
      extracted_json: makeJson({
        a: [{ name: "第四胃変位", master_code: "04-30", status: "confirmed" }],
        p: [{ name: "ブドウ糖静注500ml", type: "drug", status: "confirmed" }],
      }),
    };

    const result = await generateKyosai(input, client);

    expect(result.has_unconfirmed).toBe(false);
  });

  it("has_unconfirmed is true when a[] has unconfirmed item", async () => {
    const client = makeMockBedrock("共済ドラフト");
    const input: KyosaiInput = {
      ...BASE_INPUT,
      extracted_json: makeJson({
        a: [{ name: "第四胃変位疑い", status: "unconfirmed" }],
        p: [{ name: "ブドウ糖静注500ml", type: "drug", status: "confirmed" }],
      }),
    };

    const result = await generateKyosai(input, client);

    expect(result.has_unconfirmed).toBe(true);
  });

  it("has_unconfirmed is true when p[] has unconfirmed item", async () => {
    const client = makeMockBedrock("共済ドラフト");
    const input: KyosaiInput = {
      ...BASE_INPUT,
      extracted_json: makeJson({
        a: [{ name: "第四胃変位", master_code: "04-30", status: "confirmed" }],
        p: [{ name: "未知の処置", type: "procedure", status: "unconfirmed" }],
      }),
    };

    const result = await generateKyosai(input, client);

    expect(result.has_unconfirmed).toBe(true);
  });

  it("missing_fields contains 'disease_name' when a[] is empty", async () => {
    const client = makeMockBedrock("共済ドラフト");
    const input: KyosaiInput = {
      ...BASE_INPUT,
      extracted_json: makeJson({ a: [] }),
    };

    const result = await generateKyosai(input, client);

    expect(result.missing_fields).toContain("disease_name");
  });

  it("missing_fields contains 'disease_master_code' when a[0].master_code is missing", async () => {
    const client = makeMockBedrock("共済ドラフト");
    const input: KyosaiInput = {
      ...BASE_INPUT,
      extracted_json: makeJson({
        a: [{ name: "第四胃変位", status: "confirmed" }], // no master_code
      }),
    };

    const result = await generateKyosai(input, client);

    expect(result.missing_fields).toContain("disease_master_code");
  });

  it("missing_fields is empty when all required fields are present", async () => {
    const client = makeMockBedrock("共済ドラフト");

    const result = await generateKyosai(BASE_INPUT, client);

    expect(result.missing_fields).toHaveLength(0);
  });

  it("Bedrock send() is called exactly once", async () => {
    const client = makeMockBedrock("共済ドラフト");

    await generateKyosai(BASE_INPUT, client);

    expect((client.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("throws when Bedrock throws", async () => {
    const client = makeFailingBedrock(new Error("ServiceUnavailableException"));

    await expect(generateKyosai(BASE_INPUT, client)).rejects.toThrow(
      "ServiceUnavailableException",
    );
  });
});
