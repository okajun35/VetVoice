import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getModelConfig } from "../amplify/data/handlers/model-config";

const DEFAULT_INPUT_CSV_PATH = "tmp/soap-model-compare/soap-scoring.template.csv";
const DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1200;
const REQUIRED_COLUMNS = ["case_id", "gold_human_note", "transcript_expanded", "soap_text"];

const ASSIST_COLUMNS = [
  "llm_factual_issues",
  "llm_missing_info",
  "llm_over_inference",
  "llm_safety_risk",
  "llm_structure_note",
  "llm_suggested_factuality_1to5",
  "llm_suggested_completeness_1to5",
  "llm_suggested_readability_1to5",
  "llm_suggested_safety_1to5",
  "llm_suggested_over_inference_1to5",
  "llm_model_requested",
  "llm_model_resolved",
  "llm_error",
] as const;

interface CliOptions {
  inputCsvPath: string;
  outputDir: string;
  modelId: string;
  limit?: number;
  startAt: number;
  maxRetries: number;
  retryDelayMs: number;
}

interface CsvData {
  headers: string[];
  rows: Record<string, string>[];
}

interface AnnotationPayload {
  factual_issues: string[];
  missing_info: string[];
  over_inference: string[];
  safety_risk: string[];
  structure_note: string;
  suggested_scores: {
    factuality: number;
    completeness: number;
    readability: number;
    safety: number;
    over_inference: number;
  };
}

interface AnnotationSummary {
  generated_at: string;
  input_csv: string;
  output_csv: string;
  model_requested: string;
  model_resolved: string;
  row_count: number;
  processed_count: number;
  error_count: number;
  start_at: number;
  limit: number | null;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const inputRaw = await readFile(options.inputCsvPath, "utf8");
  const csvData = parseCsv(inputRaw);
  validateColumns(csvData.headers);

  const outputCsvPath = path.join(options.outputDir, "soap-scoring.llm-assisted.csv");
  const outputSummaryPath = path.join(options.outputDir, "soap-scoring.llm-assisted.latest.json");

  const config = getModelConfig("extractor", false, options.modelId);
  const bedrockClient = new BedrockRuntimeClient({ region: config.region });

  const start = Math.max(options.startAt, 0);
  const endExclusive = options.limit
    ? Math.min(csvData.rows.length, start + options.limit)
    : csvData.rows.length;

  let processedCount = 0;
  let errorCount = 0;

  for (let rowIndex = start; rowIndex < endExclusive; rowIndex += 1) {
    const row = csvData.rows[rowIndex];
    const caseId = row.case_id || `row-${rowIndex + 1}`;
    const prompt = buildPrompt({
      goldHumanNote: row.gold_human_note ?? "",
      transcriptExpanded: row.transcript_expanded ?? "",
      soapText: row.soap_text ?? "",
    });

    try {
      const annotation = await annotateCaseWithRetry({
        prompt,
        modelId: config.modelId,
        bedrockClient,
        maxRetries: options.maxRetries,
        retryDelayMs: options.retryDelayMs,
      });
      row.llm_factual_issues = formatList(annotation.factual_issues);
      row.llm_missing_info = formatList(annotation.missing_info);
      row.llm_over_inference = formatList(annotation.over_inference);
      row.llm_safety_risk = formatList(annotation.safety_risk);
      row.llm_structure_note = annotation.structure_note;
      row.llm_suggested_factuality_1to5 = String(annotation.suggested_scores.factuality);
      row.llm_suggested_completeness_1to5 = String(annotation.suggested_scores.completeness);
      row.llm_suggested_readability_1to5 = String(annotation.suggested_scores.readability);
      row.llm_suggested_safety_1to5 = String(annotation.suggested_scores.safety);
      row.llm_suggested_over_inference_1to5 = String(annotation.suggested_scores.over_inference);
      row.llm_model_requested = options.modelId;
      row.llm_model_resolved = config.modelId;
      row.llm_error = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorCount += 1;
      row.llm_factual_issues = "";
      row.llm_missing_info = "";
      row.llm_over_inference = "";
      row.llm_safety_risk = "";
      row.llm_structure_note = "";
      row.llm_suggested_factuality_1to5 = "";
      row.llm_suggested_completeness_1to5 = "";
      row.llm_suggested_readability_1to5 = "";
      row.llm_suggested_safety_1to5 = "";
      row.llm_suggested_over_inference_1to5 = "";
      row.llm_model_requested = options.modelId;
      row.llm_model_resolved = config.modelId;
      row.llm_error = message;
      console.error(`Annotation failed (case_id=${caseId}): ${message}`);
    }

    processedCount += 1;
    console.log(
      `Annotated ${processedCount}/${endExclusive - start} (case_id=${caseId}, row=${rowIndex + 1})`
    );
  }

  const headers = buildOutputHeaders(csvData.headers);
  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputCsvPath, serializeCsv(headers, csvData.rows), "utf8");

  const summary: AnnotationSummary = {
    generated_at: new Date().toISOString(),
    input_csv: options.inputCsvPath,
    output_csv: outputCsvPath,
    model_requested: options.modelId,
    model_resolved: config.modelId,
    row_count: csvData.rows.length,
    processed_count: processedCount,
    error_count: errorCount,
    start_at: start,
    limit: options.limit ?? null,
  };
  await writeFile(outputSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("LLM-assisted annotation complete");
  console.log(`Input CSV: ${options.inputCsvPath}`);
  console.log(`Output CSV: ${outputCsvPath}`);
  console.log(`Summary JSON: ${outputSummaryPath}`);
  console.log(
    `model_requested=${summary.model_requested}, model_resolved=${summary.model_resolved}, processed=${summary.processed_count}, errors=${summary.error_count}`
  );
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let modelId = DEFAULT_MODEL_ID;
  let limit: number | undefined;
  let startAt = 0;
  let maxRetries = DEFAULT_MAX_RETRIES;
  let retryDelayMs = DEFAULT_RETRY_DELAY_MS;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--model") {
      modelId = requireArgValue(argv[index + 1], "--model");
      index += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      modelId = arg.slice("--model=".length);
      continue;
    }
    if (arg === "--limit") {
      limit = parseLimit(requireArgValue(argv[index + 1], "--limit"));
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }
    if (arg === "--start-at") {
      startAt = parseStartAt(requireArgValue(argv[index + 1], "--start-at"));
      index += 1;
      continue;
    }
    if (arg.startsWith("--start-at=")) {
      startAt = parseStartAt(arg.slice("--start-at=".length));
      continue;
    }
    if (arg === "--max-retries") {
      maxRetries = parseNonNegativeInt(requireArgValue(argv[index + 1], "--max-retries"), "--max-retries");
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-retries=")) {
      maxRetries = parseNonNegativeInt(arg.slice("--max-retries=".length), "--max-retries");
      continue;
    }
    if (arg === "--retry-delay-ms") {
      retryDelayMs = parseNonNegativeInt(
        requireArgValue(argv[index + 1], "--retry-delay-ms"),
        "--retry-delay-ms"
      );
      index += 1;
      continue;
    }
    if (arg.startsWith("--retry-delay-ms=")) {
      retryDelayMs = parseNonNegativeInt(arg.slice("--retry-delay-ms=".length), "--retry-delay-ms");
      continue;
    }

    positional.push(arg);
  }

  const inputCsvPath = positional[0] ?? DEFAULT_INPUT_CSV_PATH;
  const outputDir = positional[1] ?? path.dirname(inputCsvPath);
  return {
    inputCsvPath,
    outputDir,
    modelId,
    limit,
    startAt,
    maxRetries,
    retryDelayMs,
  };
}

function requireArgValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: "${value}". Must be a positive integer.`);
  }
  return parsed;
}

function parseStartAt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid --start-at value: "${value}". Must be an integer >= 0.`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName} value: "${value}". Must be an integer >= 0.`);
  }
  return parsed;
}

function validateColumns(headers: string[]): void {
  const headerSet = new Set(headers);
  for (const column of REQUIRED_COLUMNS) {
    if (!headerSet.has(column)) {
      throw new Error(`Input CSV must include '${column}'.`);
    }
  }
}

function buildOutputHeaders(inputHeaders: string[]): string[] {
  const headers = [...inputHeaders];
  for (const column of ASSIST_COLUMNS) {
    if (!headers.includes(column)) {
      headers.push(column);
    }
  }
  return headers;
}

async function annotateCase(
  prompt: string,
  modelId: string,
  bedrockClient: BedrockRuntimeClient
): Promise<AnnotationPayload> {
  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 1200,
        temperature: 0,
      },
    })
  );

  const rawText = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseAnnotationResponse(rawText);
  return parsed;
}

async function annotateCaseWithRetry(input: {
  prompt: string;
  modelId: string;
  bedrockClient: BedrockRuntimeClient;
  maxRetries: number;
  retryDelayMs: number;
}): Promise<AnnotationPayload> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    const retrySuffix =
      attempt === 0
        ? ""
        : "\n\nIMPORTANT RETRY INSTRUCTION:\nYour previous output was invalid. Respond with one JSON object only and no extra text.";
    try {
      return await annotateCase(
        `${input.prompt}${retrySuffix}`,
        input.modelId,
        input.bedrockClient
      );
    } catch (error) {
      lastError = error;
      if (attempt >= input.maxRetries) {
        break;
      }
      await sleep(input.retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildPrompt(input: {
  goldHumanNote: string;
  transcriptExpanded: string;
  soapText: string;
}): string {
  return `You are assisting a human evaluator reviewing veterinary SOAP notes.

Your task is NOT to decide the final score.
Your task is to help the evaluator by identifying mismatches and issues.

Compare:
1) gold_human_note (ground truth human memo)
2) soap_text (model output)
Use transcript_expanded only as supporting context.

Evaluation dimensions:
- Factuality: numbers, left/right, drugs, dosages must align with gold_human_note.
- Completeness: list important missing items (symptoms, observations, diagnosis, treatment).
- Readability: SOAP structure clarity and naturalness.
- Safety: risky hallucinations (wrong drug, wrong dose, unsupported strong diagnosis).

Important rules:
- Over-inference in Assessment must be flagged.
- If diagnoses/conclusions are not clearly supported by findings, flag them.

Return JSON only, no markdown, no additional text.
Use this exact schema:
{
  "factual_issues": ["..."],
  "missing_info": ["..."],
  "over_inference": ["..."],
  "safety_risk": ["..."],
  "structure_note": "...",
  "suggested_scores": {
    "factuality": 1,
    "completeness": 1,
    "readability": 1,
    "safety": 1,
    "over_inference": 1
  }
}

Scoring guideline:
- Integer 1 to 5 (5 is best).
- over_inference score: 5 means no problematic over-inference.

GOLD HUMAN NOTE
--------------
${input.goldHumanNote}

TRANSCRIPT EXPANDED
--------------
${input.transcriptExpanded}

SOAP TEXT
--------------
${input.soapText}`;
}

function parseAnnotationResponse(rawText: string): AnnotationPayload {
  const jsonText = extractJsonBlock(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid annotation JSON: ${message}`);
  }

  const record = isRecord(parsed) ? parsed : {};
  const suggestedScores = isRecord(record.suggested_scores) ? record.suggested_scores : {};

  return {
    factual_issues: normalizeStringArray(record.factual_issues),
    missing_info: normalizeStringArray(record.missing_info),
    over_inference: normalizeStringArray(record.over_inference),
    safety_risk: normalizeStringArray(record.safety_risk),
    structure_note: normalizeString(record.structure_note),
    suggested_scores: {
      factuality: normalizeScore(suggestedScores.factuality),
      completeness: normalizeScore(suggestedScores.completeness),
      readability: normalizeScore(suggestedScores.readability),
      safety: normalizeScore(suggestedScores.safety),
      over_inference: normalizeScore(suggestedScores.over_inference),
    },
  };
}

function extractJsonBlock(rawText: string): string {
  const noFence = rawText
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();

  try {
    JSON.parse(noFence);
    return noFence;
  } catch {
    // Continue with best-effort extraction.
  }

  const firstBrace = noFence.indexOf("{");
  const lastBrace = noFence.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("Model output did not include a JSON object.");
  }
  return noFence.slice(firstBrace, lastBrace + 1);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScore(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 3;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return values.join(" | ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCsv(rawCsv: string): CsvData {
  const matrix = splitCsv(rawCsv);
  if (matrix.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = matrix[0].map((cell) => cell.trim());
  const rows: Record<string, string>[] = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (row.length === 1 && row[0].trim().length === 0) {
      continue;
    }
    const values: Record<string, string> = {};
    for (let column = 0; column < header.length; column += 1) {
      values[header[column]] = row[column] ?? "";
    }
    rows.push(values);
  }

  return { headers: header, rows };
}

function splitCsv(rawCsv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < rawCsv.length; index += 1) {
    const char = rawCsv[index];

    if (char === '"') {
      if (inQuotes && rawCsv[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && rawCsv[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function serializeCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    const line = headers.map((header) => toCsvCell(row[header] ?? "")).join(",");
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

function toCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
