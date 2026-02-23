/**
 * Kyosai_Generator component property tests
 * Feature: vet-voice-medical-record
 * Task 13.3
 *
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { generateKyosai } from "../../amplify/data/handlers/kyosai-generator";
import type { KyosaiInput } from "../../amplify/data/handlers/kyosai-generator";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { extractedJsonArb, cowIdArb, isoDatetimeArb } from "../helpers/generators";

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

// Arbitrary for TemplateType
const templateTypeArb = fc.oneof(
  fc.constant("general_soap" as const),
  fc.constant("reproduction_soap" as const),
  fc.constant("hoof_soap" as const),
  fc.constant("kyosai" as const),
);

// ---------------------------------------------------------------------------
// Property 8: 家畜共済ドラフトの必須フィールド含有
//
// For any ExtractedJSON:
//   - kyosai_text always equals the mock Bedrock response text (passthrough)
//   - missing_fields is always an array
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 8: 家畜共済ドラフトの必須フィールド含有", () => {
  it("kyosai_text always equals the mock Bedrock response text", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        templateTypeArb,
        cowIdArb,
        isoDatetimeArb,
        fc.string(),
        async (extractedJson, templateType, cowId, visitDatetime, mockText) => {
          const client = makeMockBedrock(mockText);
          const input: KyosaiInput = {
            extracted_json: extractedJson,
            template_type: templateType,
            cow_id: cowId,
            visit_datetime: visitDatetime,
          };

          const result = await generateKyosai(input, client);

          expect(result.kyosai_text).toBe(mockText);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("missing_fields is always an array", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        templateTypeArb,
        cowIdArb,
        isoDatetimeArb,
        async (extractedJson, templateType, cowId, visitDatetime) => {
          const client = makeMockBedrock("共済ドラフト");
          const input: KyosaiInput = {
            extracted_json: extractedJson,
            template_type: templateType,
            cow_id: cowId,
            visit_datetime: visitDatetime,
          };

          const result = await generateKyosai(input, client);

          expect(Array.isArray(result.missing_fields)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: 家畜共済未確認候補のハンドリング
//
// - has_unconfirmed is true when at least one a[] or p[] item is unconfirmed
// - has_unconfirmed is false when all items are confirmed or have no status
// - when a[] is empty, "disease_name" is always in missing_fields
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 9: 家畜共済未確認候補のハンドリング", () => {
  // Arbitrary for ExtractedJSON with at least one unconfirmed item
  const withUnconfirmedArb = extractedJsonArb.chain((json) => {
    const forceUnconfirmedA = fc
      .array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          status: fc.constant("unconfirmed" as const),
        }),
        { minLength: 1 },
      )
      .map((items) => ({ ...json, a: items }));

    const forceUnconfirmedP = fc
      .array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          type: fc.oneof(
            fc.constant("procedure" as const),
            fc.constant("drug" as const),
          ),
          status: fc.constant("unconfirmed" as const),
        }),
        { minLength: 1 },
      )
      .map((items) => ({ ...json, p: items }));

    return fc.oneof(forceUnconfirmedA, forceUnconfirmedP);
  });

  // Arbitrary for ExtractedJSON where all items are confirmed or have no status
  const allConfirmedArb = extractedJsonArb.map((json): ExtractedJSON => ({
    ...json,
    a: json.a.map((item) => ({
      ...item,
      status: item.status === "unconfirmed" ? ("confirmed" as const) : item.status,
    })),
    p: json.p.map((item) => ({
      ...item,
      status: item.status === "unconfirmed" ? ("confirmed" as const) : item.status,
    })),
  }));

  // Arbitrary for ExtractedJSON with empty a[]
  const emptyDiseaseArb = extractedJsonArb.map((json): ExtractedJSON => ({
    ...json,
    a: [],
  }));

  it("has_unconfirmed is true when at least one a[] or p[] item is unconfirmed", async () => {
    await fc.assert(
      fc.asyncProperty(
        withUnconfirmedArb,
        templateTypeArb,
        cowIdArb,
        isoDatetimeArb,
        async (extractedJson, templateType, cowId, visitDatetime) => {
          const client = makeMockBedrock("共済ドラフト");
          const input: KyosaiInput = {
            extracted_json: extractedJson,
            template_type: templateType,
            cow_id: cowId,
            visit_datetime: visitDatetime,
          };

          const result = await generateKyosai(input, client);

          expect(result.has_unconfirmed).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("has_unconfirmed is false when all items are confirmed or have no status", async () => {
    await fc.assert(
      fc.asyncProperty(
        allConfirmedArb,
        templateTypeArb,
        cowIdArb,
        isoDatetimeArb,
        async (extractedJson, templateType, cowId, visitDatetime) => {
          const client = makeMockBedrock("共済ドラフト");
          const input: KyosaiInput = {
            extracted_json: extractedJson,
            template_type: templateType,
            cow_id: cowId,
            visit_datetime: visitDatetime,
          };

          const result = await generateKyosai(input, client);

          expect(result.has_unconfirmed).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("when a[] is empty, 'disease_name' is always in missing_fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        emptyDiseaseArb,
        templateTypeArb,
        cowIdArb,
        isoDatetimeArb,
        async (extractedJson, templateType, cowId, visitDatetime) => {
          const client = makeMockBedrock("共済ドラフト");
          const input: KyosaiInput = {
            extracted_json: extractedJson,
            template_type: templateType,
            cow_id: cowId,
            visit_datetime: visitDatetime,
          };

          const result = await generateKyosai(input, client);

          expect(result.missing_fields).toContain("disease_name");
        },
      ),
      { numRuns: 50 },
    );
  });
});
