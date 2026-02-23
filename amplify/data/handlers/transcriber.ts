/**
 * Transcriber component
 * Feature: vet-voice-medical-record
 * Task 9.1
 *
 * Converts Japanese audio files to text using Amazon Transcribe.
 * LLM: Not used (Amazon Transcribe API)
 * Dependencies: TranscribeClient (injected), S3Client (injected, optional)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
  MediaFormat,
} from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscribeInput {
  audioKey: string;           // S3 key of the audio file
  language: "ja-JP";
  bucketName: string;         // S3 bucket name
  vocabularyName?: string;    // Optional custom vocabulary name
}

export interface TranscribeOutput {
  transcript_raw: string;     // Raw transcription text
  confidence: number;         // Average confidence score (0.0 - 1.0)
}

// Internal shape of Transcribe output JSON
interface TranscribeResultJson {
  results: {
    transcripts: Array<{ transcript: string }>;
    items: Array<{
      type: string;
      alternatives: Array<{ confidence: string; content: string }>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 5000;

/** Default maximum number of polling attempts (5 min = 60 x 5s) */
const DEFAULT_MAX_POLLS = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive MediaFormat from the audio file extension.
 * Defaults to "wav" for unknown extensions.
 */
function getMediaFormat(audioKey: string): MediaFormat {
  const ext = audioKey.split(".").pop()?.toLowerCase();
  const supported: Record<string, MediaFormat> = {
    wav: "wav",
    mp3: "mp3",
    mp4: "mp4",
    flac: "flac",
    ogg: "ogg",
    amr: "amr",
    webm: "webm",
  };
  return supported[ext ?? ""] ?? "wav";
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate average confidence from Transcribe result items.
 * Only "pronunciation" type items carry a confidence score.
 */
function calculateAverageConfidence(
  items: TranscribeResultJson["results"]["items"],
): number {
  const pronunciationItems = items.filter((item) => item.type === "pronunciation");
  if (pronunciationItems.length === 0) return 0;

  const total = pronunciationItems.reduce((sum, item) => {
    const conf = parseFloat(item.alternatives[0]?.confidence ?? "0");
    return sum + (isNaN(conf) ? 0 : conf);
  }, 0);

  return total / pronunciationItems.length;
}

/**
 * Fetch the Transcribe output JSON from S3.
 * Uses S3Client when provided; falls back to fetch() for HTTPS URLs.
 */
async function fetchTranscriptJson(
  transcriptUri: string,
  bucketName: string,
  s3Client?: S3Client,
): Promise<TranscribeResultJson> {
  if (s3Client) {
    let bucket = bucketName;
    let key: string;

    if (transcriptUri.startsWith("s3://")) {
      // s3://bucket-name/path/to/file.json
      const withoutScheme = transcriptUri.slice("s3://".length);
      const slashIdx = withoutScheme.indexOf("/");
      bucket = withoutScheme.slice(0, slashIdx);
      key = withoutScheme.slice(slashIdx + 1);
    } else {
      // https://s3.amazonaws.com/bucket/key  or  https://bucket.s3.amazonaws.com/key
      const url = new URL(transcriptUri);
      const pathParts = url.pathname.slice(1).split("/");
      if (url.hostname.startsWith("s3.")) {
        // Path-style: first segment is bucket
        bucket = pathParts[0];
        key = pathParts.slice(1).join("/");
      } else {
        // Virtual-hosted style: bucket is in hostname
        bucket = url.hostname.split(".")[0];
        key = pathParts.join("/");
      }
    }

    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await response.Body?.transformToString("utf-8");
    if (!body) throw new Error("Empty transcript body from S3");
    return JSON.parse(body) as TranscribeResultJson;
  }

  // Fallback: fetch via HTTPS
  const response = await fetch(transcriptUri);
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: HTTP ${response.status}`);
  }
  return (await response.json()) as TranscribeResultJson;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transcribe a Japanese audio file stored in S3.
 *
 * Workflow:
 * 1. Start a Transcribe job with a unique job name
 * 2. Poll until COMPLETED or FAILED (up to maxPolls x POLL_INTERVAL_MS)
 * 3. Fetch the output JSON from S3
 * 4. Return transcript text and average confidence
 *
 * @param input             Transcription parameters
 * @param transcribeClient  Injected TranscribeClient
 * @param s3Client          Optional injected S3Client for fetching transcript JSON
 * @param maxPolls          Maximum polling attempts (default 60 = 5 minutes)
 */
export async function transcribe(
  input: TranscribeInput,
  transcribeClient: TranscribeClient,
  s3Client?: S3Client,
  maxPolls: number = DEFAULT_MAX_POLLS,
): Promise<TranscribeOutput> {
  const jobName = `vetvoice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const startParams: Parameters<typeof StartTranscriptionJobCommand>[0] = {
    TranscriptionJobName: jobName,
    LanguageCode: input.language,
    MediaFormat: getMediaFormat(input.audioKey),
    Media: {
      MediaFileUri: `s3://${input.bucketName}/${input.audioKey}`,
    },
    OutputBucketName: input.bucketName,
    OutputKey: `transcripts/${jobName}.json`,
  };

  if (input.vocabularyName) {
    startParams.Settings = { VocabularyName: input.vocabularyName };
  }

  await transcribeClient.send(new StartTranscriptionJobCommand(startParams));

  // Polling loop
  for (let poll = 0; poll < maxPolls; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await transcribeClient.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
    );

    const job = statusResponse.TranscriptionJob;
    const status = job?.TranscriptionJobStatus;

    if (status === TranscriptionJobStatus.COMPLETED) {
      const transcriptUri = job?.Transcript?.TranscriptFileUri;
      if (!transcriptUri) {
        throw new Error("Transcription completed but TranscriptFileUri is missing");
      }

      const resultJson = await fetchTranscriptJson(
        transcriptUri,
        input.bucketName,
        s3Client,
      );

      const transcript_raw = resultJson.results.transcripts[0]?.transcript ?? "";
      const confidence = calculateAverageConfidence(resultJson.results.items);

      return { transcript_raw, confidence };
    }

    if (status === TranscriptionJobStatus.FAILED) {
      const reason = job?.FailureReason ?? "Unknown failure";
      throw new Error(`Transcription job failed: ${reason}`);
    }

    // IN_PROGRESS or QUEUED: continue polling
  }

  throw new Error(
    `Transcription job timed out after ${maxPolls * (POLL_INTERVAL_MS / 1000)} seconds`,
  );
}
