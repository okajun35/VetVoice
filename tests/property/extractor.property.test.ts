/**
 * Extractor component property tests
 * Feature: vet-voice-medical-record
 * Task 10.3
 *
 * **Validates: Requirements 5.1, 13.3**
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { extract } from "../../amplify/data/handlers/extractor";
import { parse, stringify } from "../../amplify/data/handlers/parser";
import { extractedJsonArb } from "../helpers/generators";

// ---------------------------------------------------------------------------
// Helper: build a mock BedrockRuntimeClient that returns a given JSON string
// ---------------------------------------------------------------------------

function makeBedrockClient(responseText: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [{ text: responseText }],
        },
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Property 14: Extractor output schema compliance
//
// For any valid ExtractedJSON used as a mock Bedrock response,
// extract() must return an object that:
//   1. Conforms to the ExtractedJSON schema (parse(stringify(result)) succeeds)
//   2. Is deeply equal to the original mock JSON
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 14: Extractor output schema compliance", () => {
  it("extract() output always conforms to ExtractedJSON schema", async () => {
    await fc.assert(
      fc.asyncProperty(extractedJsonArb, async (mockJson) => {
        const client = makeBedrockClient(JSON.stringify(mockJson));

        const result = await extract(
          { expanded_text: "診療テキスト" },
          client as any,
        );

        // The result must round-trip through parse/stringify successfully
        const roundTrip = parse(stringify(result));
        expect(roundTrip.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("extract() output equals the mock Bedrock response when valid", async () => {
    await fc.assert(
      fc.asyncProperty(extractedJsonArb, async (mockJson) => {
        const client = makeBedrockClient(JSON.stringify(mockJson));

        const result = await extract(
          { expanded_text: "診療テキスト" },
          client as any,
        );

        // Result should match the mock JSON exactly
        expect(result).toEqual(mockJson);
      }),
      { numRuns: 100 },
    );
  });

  it("extract() always returns a valid ExtractedJSON shape even on Bedrock errors", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (errorMessage) => {
        const client = {
          send: vi.fn().mockRejectedValue(new Error(errorMessage)),
        };

        const result = await extract(
          { expanded_text: "診療テキスト" },
          client as any,
        );

        // Must always return a schema-compliant object
        const roundTrip = parse(stringify(result));
        expect(roundTrip.success).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it("extract() always returns a valid ExtractedJSON shape for arbitrary invalid responses", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (randomText) => {
        const client = makeBedrockClient(randomText);

        const result = await extract(
          { expanded_text: "診療テキスト" },
          client as any,
        );

        // Must always return a schema-compliant object (falls back to empty default)
        const roundTrip = parse(stringify(result));
        expect(roundTrip.success).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});
