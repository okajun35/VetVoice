/**
 * SOAP_Generator component property tests
 * Feature: vet-voice-medical-record
 * Task 12.3
 *
 * **Validates: Requirements 8.1, 8.4**
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { generateSOAP } from "../../amplify/data/handlers/soap-generator";
import type { SOAPInput } from "../../amplify/data/handlers/soap-generator";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { extractedJsonArb } from "../helpers/generators";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockBedrock(responseText: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [{ text: responseText }],
        },
      },
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
// Property 6: SOAP section containment
//
// For any ExtractedJSON, if the mock Bedrock returns a given soap text,
// the result's soap_text equals that mock text exactly.
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 6: SOAP生成のセクション含有", () => {
  it("soap_text always equals the mock Bedrock response text", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        templateTypeArb,
        fc.string(),
        async (extractedJson, templateType, mockSoapText) => {
          const client = makeMockBedrock(mockSoapText);
          const input: SOAPInput = {
            extracted_json: extractedJson,
            template_type: templateType,
          };

          const result = await generateSOAP(input, client);

          expect(result.soap_text).toBe(mockSoapText);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: SOAP unconfirmed candidate flagging
//
// For any ExtractedJSON:
//   - If at least one a[] or p[] item has status "unconfirmed" -> has_unconfirmed is true
//   - If all items have status "confirmed" or no status -> has_unconfirmed is false
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 7: SOAP未確認候補の明示", () => {
  // Arbitrary for ExtractedJSON with at least one unconfirmed item in a[]
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
      status:
        item.status === "unconfirmed" ? ("confirmed" as const) : item.status,
    })),
    p: json.p.map((item) => ({
      ...item,
      status:
        item.status === "unconfirmed" ? ("confirmed" as const) : item.status,
    })),
  }));

  it("has_unconfirmed is true when at least one a[] or p[] item is unconfirmed", async () => {
    await fc.assert(
      fc.asyncProperty(
        withUnconfirmedArb,
        templateTypeArb,
        async (extractedJson, templateType) => {
          const client = makeMockBedrock("SOAP text");
          const input: SOAPInput = {
            extracted_json: extractedJson,
            template_type: templateType,
          };

          const result = await generateSOAP(input, client);

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
        async (extractedJson, templateType) => {
          const client = makeMockBedrock("SOAP text");
          const input: SOAPInput = {
            extracted_json: extractedJson,
            template_type: templateType,
          };

          const result = await generateSOAP(input, client);

          expect(result.has_unconfirmed).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});
