/**
 * Transcriber component unit tests
 * Feature: vet-voice-medical-record
 * Task 9.2
 *
 * Requirements: 3.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribe } from "../../amplify/data/handlers/transcriber";
import type { TranscribeInput } from "../../amplify/data/handlers/transcriber";

type TranscribeClientArg = Parameters<typeof transcribe>[1];
type S3ClientArg = NonNullable<Parameters<typeof transcribe>[2]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Transcribe result JSON payload */
function makeTranscriptJson(
  transcript: string,
  items: Array<{ confidence: string }> = [],
) {
  return JSON.stringify({
    results: {
      transcripts: [{ transcript }],
      items: items.map((item) => ({
        type: "pronunciation",
        alternatives: [{ confidence: item.confidence, content: "word" }],
      })),
    },
  });
}

/** Build a mock S3Client that returns the given transcript JSON body */
function makeS3Client(body: string) {
  return {
    send: vi.fn().mockResolvedValue({
      Body: {
        transformToString: vi.fn().mockResolvedValue(body),
      },
    }),
  };
}

function asTranscribeClient(client: { send: ReturnType<typeof vi.fn> }): TranscribeClientArg {
  return client as unknown as TranscribeClientArg;
}

function asS3Client(client: { send: ReturnType<typeof vi.fn> }): S3ClientArg {
  return client as unknown as S3ClientArg;
}

const BASE_INPUT: TranscribeInput = {
  audioKey: "audio/test.wav",
  language: "ja-JP",
  bucketName: "test-bucket",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transcriber: happy path", () => {
  let mockTranscribeClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockTranscribeClient = { send: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls StartTranscriptionJobCommand with correct arguments", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    await promise;

    const startCall = mockTranscribeClient.send.mock.calls[0][0];
    expect(startCall.input.TranscriptionJobName).toMatch(/^vetvoice-/);
    expect(startCall.input.LanguageCode).toBe("ja-JP");
    expect(startCall.input.MediaFormat).toBe("wav");
    expect(startCall.input.Media.MediaFileUri).toBe("s3://test-bucket/audio/test.wav");
    expect(startCall.input.OutputBucketName).toBe("test-bucket");
  });

  it("returns transcript_raw and confidence on COMPLETED status", async () => {
    const transcriptJson = makeTranscriptJson("体温は39.5度です", [
      { confidence: "0.99" },
      { confidence: "0.95" },
    ]);
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.transcript_raw).toBe("体温は39.5度です");
    expect(result.confidence).toBeCloseTo(0.97, 2);
  });

  it("polls GetTranscriptionJob after each sleep interval", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: { TranscriptionJobStatus: "IN_PROGRESS" },
      })
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 3);
    await vi.runAllTimersAsync();
    await promise;

    // send called 3 times: Start + 2 polls
    expect(mockTranscribeClient.send).toHaveBeenCalledTimes(3);
  });

  it("returns Japanese text correctly", async () => {
    const japaneseText = "牛の体温は39.5度、食欲不振あり、第四胃変位疑い";
    const transcriptJson = makeTranscriptJson(japaneseText, [{ confidence: "0.90" }]);
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.transcript_raw).toBe(japaneseText);
  });

  it("includes VocabularyName in Settings when vocabularyName is provided", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const inputWithVocab: TranscribeInput = {
      ...BASE_INPUT,
      vocabularyName: "vetvoice-vocabulary",
    };

    const promise = transcribe(inputWithVocab, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    await promise;

    const startCall = mockTranscribeClient.send.mock.calls[0][0];
    expect(startCall.input.Settings?.VocabularyName).toBe("vetvoice-vocabulary");
  });

  it("does not include Settings when vocabularyName is not provided", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    await promise;

    const startCall = mockTranscribeClient.send.mock.calls[0][0];
    expect(startCall.input.Settings).toBeUndefined();
  });

  it("derives correct MediaFormat from mp3 extension", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const mp3Input: TranscribeInput = { ...BASE_INPUT, audioKey: "audio/recording.mp3" };
    const promise = transcribe(mp3Input, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    await promise;

    const startCall = mockTranscribeClient.send.mock.calls[0][0];
    expect(startCall.input.MediaFormat).toBe("mp3");
  });

  it("returns confidence 0 when no pronunciation items exist", async () => {
    const transcriptJson = JSON.stringify({
      results: {
        transcripts: [{ transcript: "test" }],
        items: [{ type: "punctuation", alternatives: [{ confidence: "", content: "。" }] }],
      },
    });
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 1);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.confidence).toBe(0);
  });
});

/**
 * Helper: start transcribe(), immediately attach a no-op catch so Node never
 * sees an unhandled rejection, advance fake timers, then return the promise
 * so the caller can assert on it.
 */
async function runWithTimers(
  fn: () => Promise<unknown>,
): Promise<unknown> {
  const p = fn();
  p.catch(() => undefined); // suppress unhandled-rejection warning
  await vi.runAllTimersAsync();
  return p;
}

describe("Transcriber: error handling", () => {
  let mockTranscribeClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockTranscribeClient = { send: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when job status is FAILED", async () => {
    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "FAILED",
          FailureReason: "Unsupported audio format",
        },
      });

    await expect(
      runWithTimers(() => transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), undefined, 1)),
    ).rejects.toThrow("Transcription job failed: Unsupported audio format");
  });

  it("throws with generic message when FailureReason is absent", async () => {
    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: { TranscriptionJobStatus: "FAILED" },
      });

    await expect(
      runWithTimers(() => transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), undefined, 1)),
    ).rejects.toThrow("Transcription job failed: Unknown failure");
  });

  it("throws timeout error when maxPolls is exceeded", async () => {
    mockTranscribeClient.send.mockResolvedValue({
      TranscriptionJob: { TranscriptionJobStatus: "IN_PROGRESS" },
    });

    await expect(
      runWithTimers(() => transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), undefined, 2)),
    ).rejects.toThrow("Transcription job timed out");
  });

  it("timeout message includes elapsed seconds", async () => {
    mockTranscribeClient.send.mockResolvedValue({
      TranscriptionJob: { TranscriptionJobStatus: "IN_PROGRESS" },
    });

    // maxPolls=3, POLL_INTERVAL_MS=5000 => 15 seconds
    await expect(
      runWithTimers(() => transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), undefined, 3)),
    ).rejects.toThrow("15 seconds");
  });

  it("throws when TranscriptFileUri is missing on COMPLETED", async () => {
    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: {},
        },
      });

    await expect(
      runWithTimers(() => transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), undefined, 1)),
    ).rejects.toThrow("TranscriptFileUri is missing");
  });
});

describe("Transcriber: QUEUED status handling", () => {
  let mockTranscribeClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockTranscribeClient = { send: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("continues polling when status is QUEUED then completes", async () => {
    const transcriptJson = makeTranscriptJson("test");
    const mockS3 = makeS3Client(transcriptJson);

    mockTranscribeClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: { TranscriptionJobStatus: "QUEUED" },
      })
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: "COMPLETED",
          Transcript: { TranscriptFileUri: "s3://test-bucket/transcripts/job.json" },
        },
      });

    const promise = transcribe(BASE_INPUT, asTranscribeClient(mockTranscribeClient), asS3Client(mockS3), 3);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.transcript_raw).toBe("test");
    expect(mockTranscribeClient.send).toHaveBeenCalledTimes(3);
  });
});
