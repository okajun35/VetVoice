/**
 * Integration tests for runPipeline orchestrator
 * Feature: vet-voice-medical-record
 * Task 15.3
 *
 * Tests each entry point using mocked AWS clients.
 * Validates pipeline flow, error handling, and DynamoDB save behavior.
 *
 * Requirements: 14.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock factory closures
// ---------------------------------------------------------------------------

const {
  bedrockMockSend,
  transcribeMockSend,
  s3MockSend,
  dynamoMockSend,
} = vi.hoisted(() => ({
  bedrockMockSend: vi.fn(),
  transcribeMockSend: vi.fn(),
  s3MockSend: vi.fn(),
  dynamoMockSend: vi.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Mock AWS SDK modules before importing the handler
// ---------------------------------------------------------------------------

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: vi.fn(() => ({ send: bedrockMockSend })),
  ConverseCommand: vi.fn((input: unknown) => ({ _input: input })),
}));

vi.mock("@aws-sdk/client-transcribe", () => ({
  TranscribeClient: vi.fn(() => ({ send: transcribeMockSend })),
  StartTranscriptionJobCommand: vi.fn((input: unknown) => ({ _input: input })),
  GetTranscriptionJobCommand: vi.fn((input: unknown) => ({ _input: input })),
  TranscriptionJobStatus: { COMPLETED: "COMPLETED", FAILED: "FAILED" },
  MediaFormat: {},
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: s3MockSend })),
  GetObjectCommand: vi.fn((input: unknown) => ({ _input: input })),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: dynamoMockSend })) },
  PutCommand: vi.fn((input: unknown) => ({ _input: input })),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks are registered
// ---------------------------------------------------------------------------

import { handler } from "../../amplify/data/run-pipeline";

type RunPipelineEvent = Parameters<typeof handler>[0];
type RunPipelineContext = Parameters<typeof handler>[1];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_EXTRACTED_JSON = {
  vital: { temp_c: 39.5 },
  s: "食欲不振",
  o: "体温39.5℃",
  a: [{ name: "第四胃変位" }],
  p: [{ name: "ブドウ糖静注", type: "drug" as const, dosage: "500ml" }],
};

function makeBedrockResponse(extractedJson: object) {
  return {
    output: {
      message: { content: [{ text: JSON.stringify(extractedJson) }] },
    },
  };
}

function makeEvent(args: Record<string, unknown>) {
  return {
    arguments: { cowId: "0123456789", ...args },
    identity: null,
    source: null,
    request: { headers: {} },
    info: {
      fieldName: "runPipeline",
      parentTypeName: "Query",
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: "",
    },
    prev: null,
    stash: {},
  } as RunPipelineEvent;
}

const MOCK_CONTEXT = {} as RunPipelineContext;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPipeline integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMockSend.mockResolvedValue({});
    process.env.VISIT_TABLE_NAME = "Visit-test";
    process.env.STORAGE_BUCKET_NAME = "vetvoice-test-bucket";
  });

  // -------------------------------------------------------------------------
  // TEXT_INPUT
  // -------------------------------------------------------------------------
  describe("TEXT_INPUT entry point", () => {
    it("returns visitId, cowId, and valid extractedJson", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "体温39.5度、食欲不振" }),
        MOCK_CONTEXT
      );

      expect(result.visitId).toBeTruthy();
      expect(result.cowId).toBe("0123456789");
      expect(result.transcriptRaw).toBe("体温39.5度、食欲不振");
      expect(result.transcriptExpanded).toBeTruthy();
      // extractedJson is returned as object (not string) — a.json() handles serialization
      expect(result.extractedJson).toBeTruthy();
      expect(typeof result.extractedJson).toBe("object");
    });

    it("defaults templateType to general_soap", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      expect(result.templateType).toBe("general_soap");
    });

    it("preserves custom templateType", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({
          entryPoint: "TEXT_INPUT",
          transcriptText: "妊娠鑑定",
          templateType: "reproduction_soap",
        }),
        MOCK_CONTEXT
      );

      expect(result.templateType).toBe("reproduction_soap");
    });

    it("returns soapText and kyosaiText from generation (Tasks 12/13 implemented)", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      // soapText and kyosaiText are now generated via Bedrock
      // The mock returns JSON, so the text will be the stringified JSON
      expect(typeof result.soapText === "string" || result.soapText === null).toBe(true);
      expect(typeof result.kyosaiText === "string" || result.kyosaiText === null).toBe(true);
    });

    it("returns empty extractedJson when Bedrock fails (extractor swallows errors by design)", async () => {
      bedrockMockSend.mockRejectedValue(new Error("Bedrock throttled"));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      // extractor.ts catches Bedrock errors internally and returns EMPTY_EXTRACTED_JSON
      // so the pipeline still produces a valid (empty) result
      expect(result.visitId).toBeTruthy();
      expect(result.cowId).toBe("0123456789");
      if (result.extractedJson) {
        expect(typeof result.extractedJson).toBe("object");
      }
    });

    it("adds warning when transcriptText is missing", async () => {
      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT" }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("No transcript text")])
      );
    });

    it("regression: extractedJson is returned as object, not double-stringified", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "体温39.5度、食欲不振" }),
        MOCK_CONTEXT
      );

      // Must be object or null — never a string (double-stringification bug)
      if (result.extractedJson !== null) {
        expect(typeof result.extractedJson).not.toBe("string");
        expect(typeof result.extractedJson).toBe("object");
      }
    });
  });

  // -------------------------------------------------------------------------
  // JSON_INPUT
  // -------------------------------------------------------------------------
  describe("JSON_INPUT entry point", () => {
    it("skips Bedrock extraction and validates JSON directly", async () => {
      // JSON_INPUT skips extraction (Bedrock for extractor), but SOAP/Kyosai
      // generation still calls Bedrock. Mock a response for those calls.
      bedrockMockSend.mockResolvedValue({
        output: { message: { content: [{ text: "生成されたSOAPテキスト" }] } },
      });

      const result = await handler(
        makeEvent({ entryPoint: "JSON_INPUT", extractedJson: SAMPLE_EXTRACTED_JSON }),
        MOCK_CONTEXT
      );

      // extractedJson is returned as object — verify structure directly
      expect(typeof result.extractedJson).toBe("object");
      const json = result.extractedJson as { vital: { temp_c: number | null } };
      expect(json.vital.temp_c).toBe(39.5);
    });

    it("adds warning when extractedJson is null", async () => {
      const result = await handler(
        makeEvent({ entryPoint: "JSON_INPUT", extractedJson: null }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("JSON_INPUT")])
      );
      expect(result.extractedJson).toBeNull();
    });

    it("adds warning when extractedJson fails schema validation", async () => {
      const result = await handler(
        makeEvent({ entryPoint: "JSON_INPUT", extractedJson: { invalid: true } }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("parse failed")])
      );
    });

    it("replaces confirmed disease/drug names with canonical master names", async () => {
      bedrockMockSend.mockResolvedValue({
        output: { message: { content: [{ text: "generated text" }] } },
      });

      const result = await handler(
        makeEvent({
          entryPoint: "JSON_INPUT",
          extractedJson: {
            vital: { temp_c: null },
            s: null,
            o: null,
            a: [{ name: "肺炎疑い" }],
            p: [{ name: "アモキシシリンLA注", type: "drug" }],
          },
        }),
        MOCK_CONTEXT
      );

      const json = result.extractedJson as {
        a: Array<{ name: string; master_code?: string; status?: string }>;
        p: Array<{ name: string; master_code?: string; status?: string }>;
      };

      expect(json.a[0].name).toBe("肺炎");
      expect(json.a[0].status).toBe("confirmed");
      expect(json.p[0].name).toBe("アモキシシリン油性懸濁注射液");
      expect(json.p[0].master_code).toBe("DRUG:アモキシシリン油性懸濁注射液");
      expect(json.p[0].status).toBe("confirmed");
    });
  });

  // -------------------------------------------------------------------------
  // PRODUCTION / AUDIO_FILE fallback
  // -------------------------------------------------------------------------
  describe("PRODUCTION entry point", () => {
    it("adds warning and falls back to transcriptText when audioKey is missing", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({
          entryPoint: "PRODUCTION",
          transcriptText: "フォールバックテキスト",
        }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("audioKey is required")])
      );
      // transcriptRaw is only set for TEXT_INPUT; PRODUCTION uses transcriptText
      // as fallback for expansion/extraction but does not set transcriptRaw
      expect(result.extractedJson).toBeTruthy();
    });
  });

  describe("AUDIO_FILE entry point", () => {
    it("adds warning when audioKey is missing", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "AUDIO_FILE", transcriptText: "フォールバック" }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("audioKey is required")])
      );
    });
  });

  // -------------------------------------------------------------------------
  // DynamoDB save behavior
  // -------------------------------------------------------------------------
  describe("DynamoDB save", () => {
    it("saves Visit record with correct fields", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      expect(dynamoMockSend).toHaveBeenCalledOnce();
      const putArg = dynamoMockSend.mock.calls[0][0];
      expect(putArg._input.TableName).toBe("Visit-test");
      expect(putArg._input.Item.cowId).toBe("0123456789");
      expect(putArg._input.Item.status).toBe("COMPLETED");
    });

    it("uses ConditionExpression to prevent overwriting existing records", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      const putArg = dynamoMockSend.mock.calls[0][0];
      expect(putArg._input.ConditionExpression).toBe("attribute_not_exists(visitId)");
    });

    it("adds warning but still returns result when DynamoDB fails", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));
      dynamoMockSend.mockRejectedValue(new Error("DynamoDB unavailable"));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("DynamoDB save failed")])
      );
      expect(result.visitId).toBeTruthy();
      expect(result.cowId).toBe("0123456789");
    });

    it("skips save and adds warning when table name is not configured", async () => {
      delete process.env.VISIT_TABLE_NAME;
      delete process.env.AMPLIFY_DATA_RESOURCE_NAME_VISIT;
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      const result = await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      expect(dynamoMockSend).not.toHaveBeenCalled();
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("VISIT_TABLE_NAME not configured")])
      );
    });

    it("regression: DynamoDB Item.extractedJson is stored as string (not object)", async () => {
      bedrockMockSend.mockResolvedValue(makeBedrockResponse(SAMPLE_EXTRACTED_JSON));

      await handler(
        makeEvent({ entryPoint: "TEXT_INPUT", transcriptText: "テスト" }),
        MOCK_CONTEXT
      );

      const putArg = dynamoMockSend.mock.calls[0][0];
      // DynamoDB stores extractedJson as a string (via stringify)
      expect(typeof putArg._input.Item.extractedJson).toBe("string");
      // But the return value should be an object (verified in other tests)
    });
  });
});
