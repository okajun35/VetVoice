/**
 * generateHistorySummary unit tests
 * Feature: vet-voice-medical-record
 * Task 16.2
 *
 * Requirements: 17.1, 17.3, 17.4
 */

import { describe, it, expect, vi } from "vitest";
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

function makeFailingDynamo(error: Error = new Error("DynamoDB error")) {
  return {
    send: vi.fn().mockRejectedValue(error),
  } as unknown as DynamoDBDocumentClient;
}

function makeFailingBedrock(error: Error = new Error("Bedrock error")) {
  return {
    send: vi.fn().mockRejectedValue(error),
  } as unknown as BedrockRuntimeClient;
}

// Sample visit items
const visitWithJson = {
  visitId: "visit-1",
  cowId: "cow-001",
  datetime: "2024-01-15T10:00:00Z",
  extractedJson: JSON.stringify({
    vital: { temp_c: 39.5 },
    s: "食欲不振",
    o: "第一胃蠕動音減弱",
    a: [{ name: "第四胃変位", status: "confirmed" }],
    p: [{ name: "ブドウ糖静注500ml", type: "drug" }],
  }),
};

const visitWithoutJson = {
  visitId: "visit-2",
  cowId: "cow-001",
  datetime: "2024-01-10T09:00:00Z",
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe("generateHistorySummaryCore", () => {
  it("returns '診療履歴がありません' when 0 visits found", async () => {
    const dynamo = makeMockDynamo([]);
    const bedrock = makeMockBedrock("should not be called");

    const result = await generateHistorySummaryCore(
      "cow-001",
      dynamo,
      bedrock,
      "VisitTable"
    );

    expect(result).toBe("診療履歴がありません");
    expect((bedrock.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("calls Bedrock and returns summary text when 1 visit found", async () => {
    const dynamo = makeMockDynamo([visitWithJson]);
    const bedrock = makeMockBedrock("直近1件の診療: 第四胃変位の治療を実施");

    const result = await generateHistorySummaryCore(
      "cow-001",
      dynamo,
      bedrock,
      "VisitTable"
    );

    expect(result).toBe("直近1件の診療: 第四胃変位の治療を実施");
    expect((bedrock.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("calls Bedrock exactly once and returns summary text when 3 visits found", async () => {
    const visit2 = {
      ...visitWithJson,
      visitId: "visit-2",
      datetime: "2024-01-10T09:00:00Z",
    };
    const visit3 = {
      ...visitWithJson,
      visitId: "visit-3",
      datetime: "2024-01-05T08:00:00Z",
    };
    const dynamo = makeMockDynamo([visitWithJson, visit2, visit3]);
    const bedrock = makeMockBedrock("直近3件の診療サマリー");

    const result = await generateHistorySummaryCore(
      "cow-001",
      dynamo,
      bedrock,
      "VisitTable"
    );

    expect(result).toBe("直近3件の診療サマリー");
    expect((bedrock.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("still calls Bedrock when visits have no extractedJson", async () => {
    const dynamo = makeMockDynamo([visitWithoutJson]);
    const bedrock = makeMockBedrock("データなしのサマリー");

    const result = await generateHistorySummaryCore(
      "cow-001",
      dynamo,
      bedrock,
      "VisitTable"
    );

    expect(result).toBe("データなしのサマリー");
    expect((bedrock.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("DynamoDB query uses correct GSI parameters", async () => {
    const dynamo = makeMockDynamo([]);
    const bedrock = makeMockBedrock("unused");

    await generateHistorySummaryCore("cow-999", dynamo, bedrock, "MyVisitTable");

    const callArg = (dynamo.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.input.TableName).toBe("MyVisitTable");
    expect(callArg.input.IndexName).toBe("cowId-datetime-index");
    expect(callArg.input.ScanIndexForward).toBe(false);
    expect(callArg.input.Limit).toBe(3);
    expect(callArg.input.ExpressionAttributeValues[":cowId"]).toBe("cow-999");
  });

  it("propagates error when Bedrock throws", async () => {
    const dynamo = makeMockDynamo([visitWithJson]);
    const bedrock = makeFailingBedrock(new Error("ThrottlingException"));

    await expect(
      generateHistorySummaryCore("cow-001", dynamo, bedrock, "VisitTable")
    ).rejects.toThrow("ThrottlingException");
  });

  it("propagates error when DynamoDB throws", async () => {
    const dynamo = makeFailingDynamo(new Error("ResourceNotFoundException"));
    const bedrock = makeMockBedrock("unused");

    await expect(
      generateHistorySummaryCore("cow-001", dynamo, bedrock, "VisitTable")
    ).rejects.toThrow("ResourceNotFoundException");
  });
});
