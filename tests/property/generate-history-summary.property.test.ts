/**
 * generateHistorySummary property tests
 * Feature: vet-voice-medical-record
 * Task 16.3
 *
 * **Validates: Requirements 17.1, 17.3**
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { generateHistorySummaryCore } from "../../amplify/data/generate-history-summary";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockDynamo(items: unknown[]) {
  return {
    send: vi.fn().mockResolvedValue({ Items: items, Count: items.length }),
  } as unknown as DynamoDBDocumentClient;
}

function makeMockBedrock(text: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: { message: { content: [{ text }] } },
    }),
  } as unknown as BedrockRuntimeClient;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Arbitrary for a single visit item (extractedJson is optional)
const visitItemArb = fc.record({
  visitId: fc.string({ minLength: 1 }),
  cowId: fc.string({ minLength: 1 }),
  datetime: fc.string({ minLength: 1 }),
  extractedJson: fc.option(fc.string()),
});

// Arbitrary for 0–3 visit items (the max DynamoDB returns with Limit: 3)
const visitArrayArb = fc.array(visitItemArb, { minLength: 0, maxLength: 3 });

// ---------------------------------------------------------------------------
// Property 18: 診療履歴サマリーのVisit件数制約
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 18: 診療履歴サマリーのVisit件数制約", () => {
  it("DynamoDB is always queried with Limit: 3", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // cowId
        fc.string({ minLength: 1 }), // tableName
        async (cowId, tableName) => {
          const dynamo = makeMockDynamo([]);
          const bedrock = makeMockBedrock("unused");

          await generateHistorySummaryCore(cowId, dynamo, bedrock, tableName);

          const callArg = (dynamo.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
          expect(callArg.input.Limit).toBe(3);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("returns '診療履歴がありません' for any cowId when Items is empty", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // cowId
        async (cowId) => {
          const dynamo = makeMockDynamo([]);
          const bedrock = makeMockBedrock("should not be used");

          const result = await generateHistorySummaryCore(
            cowId,
            dynamo,
            bedrock,
            "TestTable"
          );

          expect(result).toBe("診療履歴がありません");
        },
      ),
      { numRuns: 50 },
    );
  });

  it("calls Bedrock exactly once when Items has 1–3 entries", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(visitItemArb, { minLength: 1, maxLength: 3 }),
        fc.string({ minLength: 1 }),
        async (items, summaryText) => {
          const dynamo = makeMockDynamo(items);
          const bedrock = makeMockBedrock(summaryText);

          await generateHistorySummaryCore(
            "cow-test",
            dynamo,
            bedrock,
            "TestTable"
          );

          expect(
            (bedrock.send as ReturnType<typeof vi.fn>).mock.calls
          ).toHaveLength(1);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("return value is always a string for any visit array (0–3 items)", async () => {
    await fc.assert(
      fc.asyncProperty(visitArrayArb, async (items) => {
        const summaryText = "サマリーテキスト";
        const dynamo = makeMockDynamo(items);
        const bedrock = makeMockBedrock(summaryText);

        const result = await generateHistorySummaryCore(
          "cow-test",
          dynamo,
          bedrock,
          "TestTable"
        );

        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});
