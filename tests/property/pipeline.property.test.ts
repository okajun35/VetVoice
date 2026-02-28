/**
 * Property-based tests for runPipeline orchestrator
 * Feature: vet-voice-medical-record
 * Task 15.4
 *
 * **Validates: Requirements 14.5**
 *
 * Property 13: エントリポイント同一ロジック
 * After the entry-point-specific skip phase, all entry points execute the
 * same downstream logic (Parser validation, DynamoDB save, PipelineOutput
 * shape). This property verifies the structural invariants that must hold
 * for every entry point and every valid input.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { extractedJsonArb, cowIdArb } from "../helpers/generators";

// ---------------------------------------------------------------------------
// Hoist mock functions
// ---------------------------------------------------------------------------

const { bedrockMockSend, dynamoMockSend } = vi.hoisted(() => ({
  bedrockMockSend: vi.fn(),
  dynamoMockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: vi.fn(() => ({ send: bedrockMockSend })),
  ConverseCommand: vi.fn((input: unknown) => ({ _input: input })),
}));

vi.mock("@aws-sdk/client-transcribe", () => ({
  TranscribeClient: vi.fn(() => ({ send: vi.fn() })),
  StartTranscriptionJobCommand: vi.fn(),
  GetTranscriptionJobCommand: vi.fn(),
  TranscriptionJobStatus: { COMPLETED: "COMPLETED", FAILED: "FAILED" },
  MediaFormat: {},
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: dynamoMockSend })) },
  PutCommand: vi.fn((input: unknown) => ({ _input: input })),
}));

import { handler } from "../../amplify/data/run-pipeline";
import {
  guardVisitUpdate,
  type VisitSourceOfTruth,
  type VisitUpdatePayload,
} from "../../amplify/data/handlers/visit-guard";

type RunPipelineEvent = Parameters<typeof handler>[0];
type RunPipelineContext = Parameters<typeof handler>[1];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Property 13: エントリポイント同一ロジック
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 13: エントリポイント同一ロジック", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMockSend.mockResolvedValue({});
    process.env.VISIT_TABLE_NAME = "Visit-test";
  });

  /**
   * Property 13a: PipelineOutput shape invariant
   *
   * For every entry point and every valid input, the handler always returns
   * an object with the required PipelineOutput fields.
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13a: every entry point always returns a complete PipelineOutput shape", async () => {
    await fc.assert(
      fc.asyncProperty(
        cowIdArb,
        extractedJsonArb,
        fc.string({ minLength: 1 }),
        async (cowId, extractedJson, transcriptText) => {
          bedrockMockSend.mockResolvedValue(makeBedrockResponse(extractedJson));

          const textResult = await handler(
            makeEvent({ entryPoint: "TEXT_INPUT", cowId, transcriptText }),
            MOCK_CONTEXT
          );
          expect(textResult).toHaveProperty("visitId");
          expect(textResult).toHaveProperty("cowId", cowId);
          expect(textResult).toHaveProperty("templateType");
          expect(Array.isArray(textResult.warnings)).toBe(true);

          const jsonResult = await handler(
            makeEvent({ entryPoint: "JSON_INPUT", cowId, extractedJson }),
            MOCK_CONTEXT
          );
          expect(jsonResult).toHaveProperty("visitId");
          expect(jsonResult).toHaveProperty("cowId", cowId);
          expect(Array.isArray(jsonResult.warnings)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  /**
   * Property 13b: visitId uniqueness
   *
   * Each invocation generates a distinct visitId (UUID v4).
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13b: each invocation produces a unique visitId", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        async (extractedJson) => {
          bedrockMockSend.mockResolvedValue(makeBedrockResponse(extractedJson));

          const [r1, r2] = await Promise.all([
            handler(makeEvent({ entryPoint: "JSON_INPUT", extractedJson }), MOCK_CONTEXT),
            handler(makeEvent({ entryPoint: "JSON_INPUT", extractedJson }), MOCK_CONTEXT),
          ]);

          expect(r1.visitId).not.toBe(r2.visitId);
        }
      ),
      { numRuns: 20 }
    );
  }, 20000);

  /**
   * Property 13c: JSON_INPUT preserves core fields through Parser path
   *
   * When a valid ExtractedJSON is passed via JSON_INPUT, core scalar fields are
   * preserved. A/P arrays may be reclassified by downstream routing logic
   * (Step 2.2), so strict per-array length equality is not guaranteed.
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13c: JSON_INPUT preserves core fields while allowing A/P reclassification", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        async (extractedJson) => {
          const result = await handler(
            makeEvent({ entryPoint: "JSON_INPUT", extractedJson }),
            MOCK_CONTEXT
          );

          // extractedJson is returned as object (a.json() handles serialization)
          expect(result.extractedJson).toBeTruthy();
          expect(typeof result.extractedJson).toBe("object");

          type MinimalExtractedJson = {
            vital: { temp_c: number | null };
            s: string | null;
            o: string | null;
            a: Array<{ name: string }>;
            p: Array<{ name: string; type: "procedure" | "drug" }>;
          };

          // Undefined optional fields are dropped during JSON serialization in the pipeline.
          const normalizedExpected = JSON.parse(
            JSON.stringify(extractedJson)
          ) as MinimalExtractedJson;
          const resultJson = result.extractedJson as MinimalExtractedJson;

          // Core scalar fields should be preserved across JSON_INPUT processing.
          expect(resultJson.vital.temp_c).toBe(normalizedExpected.vital.temp_c);
          expect(resultJson.s).toBe(normalizedExpected.s);
          expect(resultJson.o).toBe(normalizedExpected.o);

          // A/P may be reclassified; ensure structural validity only.
          expect(Array.isArray(resultJson.a)).toBe(true);
          expect(Array.isArray(resultJson.p)).toBe(true);

          // Reclassification and de-duplication must not increase total entities.
          const totalIn = normalizedExpected.a.length + normalizedExpected.p.length;
          const totalOut = resultJson.a.length + resultJson.p.length;
          expect(totalOut).toBeLessThanOrEqual(totalIn);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  /**
   * Property 13d: cowId is always echoed back unchanged
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13d: cowId is always echoed back unchanged in PipelineOutput", async () => {
    await fc.assert(
      fc.asyncProperty(
        cowIdArb,
        extractedJsonArb,
        async (cowId, extractedJson) => {
          bedrockMockSend.mockResolvedValue(makeBedrockResponse(extractedJson));

          for (const entryPoint of ["TEXT_INPUT", "JSON_INPUT"] as const) {
            const result = await handler(
              makeEvent({ entryPoint, cowId, transcriptText: "テスト", extractedJson }),
              MOCK_CONTEXT
            );
            expect(result.cowId).toBe(cowId);
          }
        }
      ),
      { numRuns: 25 }
    );
  }, 30000);

  /**
   * Property 13e: soapText and kyosaiText are strings or null (Tasks 12/13 implemented)
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13e: soapText and kyosaiText are strings or null after Tasks 12/13 implementation", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        async (extractedJson) => {
          bedrockMockSend.mockResolvedValue({
            output: { message: { content: [{ text: "生成テキスト" }] } },
          });

          const result = await handler(
            makeEvent({ entryPoint: "JSON_INPUT", extractedJson }),
            MOCK_CONTEXT
          );

          // soapText and kyosaiText are now generated — must be string or null
          expect(
            result.soapText === null || typeof result.soapText === "string"
          ).toBe(true);
          expect(
            result.kyosaiText === null || typeof result.kyosaiText === "string"
          ).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 20000);

  /**
   * Property 13f: warnings is always a non-null array
   *
   * **Validates: Requirements 14.5**
   */
  it("Property 13f: warnings is always a non-null array regardless of entry point", async () => {
    await fc.assert(
      fc.asyncProperty(
        extractedJsonArb,
        fc.string(),
        async (extractedJson, transcriptText) => {
          bedrockMockSend.mockResolvedValue(makeBedrockResponse(extractedJson));

          const results = await Promise.all([
            handler(makeEvent({ entryPoint: "TEXT_INPUT", transcriptText }), MOCK_CONTEXT),
            handler(makeEvent({ entryPoint: "JSON_INPUT", extractedJson }), MOCK_CONTEXT),
            handler(makeEvent({ entryPoint: "PRODUCTION" }), MOCK_CONTEXT),
            handler(makeEvent({ entryPoint: "AUDIO_FILE" }), MOCK_CONTEXT),
          ]);

          for (const result of results) {
            expect(Array.isArray(result.warnings)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// Visit guard pure function properties (Task 15.2)
// ---------------------------------------------------------------------------

describe("Feature: vet-voice-medical-record, Property 13 (guard): Visitデータ保全の不変条件", () => {
  /**
   * Property: existing non-empty values are never overwritten with null/empty
   *
   * **Validates: Requirements 10.5, 12.3, 12.4**
   */
  it("Property: guardVisitUpdate rejects null/empty overwrites of set fields", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        (existingRaw, existingJson, emptyValue) => {
          const existing: VisitSourceOfTruth = {
            transcriptRaw: existingRaw,
            extractedJson: existingJson,
          };
          const update: VisitUpdatePayload = {
            transcriptRaw: emptyValue as null,
            extractedJson: emptyValue as null,
          };

          const result = guardVisitUpdate(existing, update);

          expect(result.rejectedFields).toContain("transcriptRaw");
          expect(result.rejectedFields).toContain("extractedJson");
          expect(result.safePayload).not.toHaveProperty("transcriptRaw");
          expect(result.safePayload).not.toHaveProperty("extractedJson");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: updates with valid (non-empty) values are always allowed
   *
   * **Validates: Requirements 10.5, 12.3, 12.4**
   */
  it("Property: guardVisitUpdate allows non-empty value updates", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (existingRaw, existingJson, newRaw, newJson) => {
          const existing: VisitSourceOfTruth = {
            transcriptRaw: existingRaw,
            extractedJson: existingJson,
          };
          const update: VisitUpdatePayload = {
            transcriptRaw: newRaw,
            extractedJson: newJson,
          };

          const result = guardVisitUpdate(existing, update);

          expect(result.rejectedFields).not.toContain("transcriptRaw");
          expect(result.rejectedFields).not.toContain("extractedJson");
          expect(result.safePayload.transcriptRaw).toBe(newRaw);
          expect(result.safePayload.extractedJson).toBe(newJson);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: when existing fields are absent/null, any update is allowed
   *
   * **Validates: Requirements 10.5, 12.3, 12.4**
   */
  it("Property: guardVisitUpdate allows any update when existing fields are absent", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(""), fc.string()),
        (existingRaw, existingJson, proposedValue) => {
          const existing: VisitSourceOfTruth = {
            transcriptRaw: existingRaw as null,
            extractedJson: existingJson as null,
          };
          const update: VisitUpdatePayload = {
            transcriptRaw: proposedValue as null,
            extractedJson: proposedValue as null,
          };

          const result = guardVisitUpdate(existing, update);

          expect(result.rejectedFields).toHaveLength(0);
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
