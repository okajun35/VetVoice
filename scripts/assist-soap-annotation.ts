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
  "error_type_primary",
  "error_tags",
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
  error_type_primary_counts: Record<string, number>;
  error_tag_counts: Record<string, number>;
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

    const classified = classifySoapErrorType(row);
    row.error_type_primary = classified.primary;
    row.error_tags = classified.tags.join("|");

    processedCount += 1;
    console.log(
      `Annotated ${processedCount}/${endExclusive - start} (case_id=${caseId}, row=${rowIndex + 1})`
    );
  }

  const headers = buildOutputHeaders(csvData.headers);
  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputCsvPath, serializeCsv(headers, csvData.rows), "utf8");

  const classificationSummary = summarizeClassifications(
    csvData.rows.slice(start, endExclusive),
  );

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
    error_type_primary_counts: classificationSummary.primaryCounts,
    error_tag_counts: classificationSummary.tagCounts,
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

const PROMPT_LEAK_PATTERNS = [
  /SOAP形式の診療記録(?:は|を)?以下の通り/iu,
  /この診療記録は/iu,
  /以下に作成しました/iu,
  /Unconfirmedの候補には/iu,
  /提供された構造化データに基づいて/iu,
];

const PLAN_ENTITY_TOKEN_PATTERN = /[A-Za-z]{2,}|[ァ-ヶー]{2,}|[一-龯々]{2,}/gu;
const PLAN_ENTITY_STOPWORDS = new Set([
  "投与",
  "実施",
  "施行",
  "予定",
  "計画",
  "処置",
  "診療",
  "記録",
  "評価",
  "診断",
  "確認",
  "記載",
  "中",
  "あり",
  "なし",
  "再",
  "検査",
  "所見",
  "症状",
  "体温",
  "心拍",
  "呼吸",
  "脈拍",
  "糞便",
  "ケトン臭",
  "ラッセル音",
  "ミリ",
  "リッター",
  "アンプル",
  "本",
  "日",
]);

const GOLD_UNCERTAIN_PATTERNS = [
  /疑い/iu,
  /未確認/iu,
  /可能性/iu,
  /suspected/iu,
];

const SOAP_UNCERTAIN_PATTERNS = [
  /疑い/iu,
  /未確認/iu,
  /可能性/iu,
  /保留/iu,
];

const SOAP_ASSERTIVE_PATTERNS = [
  /確定/iu,
  /断定/iu,
  /確診/iu,
  /confirmed/iu,
  /definitive/iu,
];

const SOAP_DIAGNOSIS_LABEL_PATTERNS = [
  /肺炎/iu,
  /ケトーシス/iu,
  /妊娠/iu,
  /乳房炎/iu,
  /第四胃変位/iu,
  /卵巣嚢腫/iu,
  /子宮内膜炎/iu,
  /診断/iu,
];

const TERMINOLOGY_PATTERNS = [
  /経観/iu,
  /経膣検査/iu,
  /子宮内デバイス/iu,
  /膣内挿入/iu,
];

const TERMINOLOGY_CIDR_MISUSE_PATTERNS = [
  /CIDR.{0,12}(?:子宮内|子宮内デバイス|経膣検査)/iu,
  /(?:子宮内|子宮内デバイス|経膣検査).{0,12}CIDR/iu,
];

const FACTUAL_GOLD_500_MILLI_PATTERN = /500\s*ミリ/iu;
const FACTUAL_SOAP_500_WITH_UNIT_PATTERN = /500\s*(?:mg|ml|mL|mm)\b/iu;
const FACTUAL_SOAP_500_MILLI_PATTERN = /500\s*ミリ/iu;
const FACTUAL_GOLD_SCORE_PATTERN = /(?:cl|CL)[^0-9]{0,6}5|cl.?の?\s*5|黄体[^0-9]{0,6}5|スコア[^0-9]{0,6}5/u;
const FACTUAL_SOAP_MM_PATTERN = /\b5\s*mm\b/u;
const FACTUAL_GOLD_MM_PATTERN = /\b5\s*mm\b/u;

const PRIMARY_PRIORITY = [
  "PROMPT_LEAK",
  "PLAN_HALLUCINATION",
  "DX_ASSERTION",
  "TERMINOLOGY_ERROR",
  "FACTUAL_ISSUE",
] as const;

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractSoapSections(soapText: string): {
  s: string;
  o: string;
  a: string;
  p: string;
} {
  const normalized = soapText.replace(/\r\n/gu, "\n");
  const headingRegex = /(?:^|\n)\s*([SOAP])(?:（[^）]*）|\([^)]*\))?\s*:/gu;
  const matches = [...normalized.matchAll(headingRegex)];

  if (matches.length === 0) {
    return { s: "", o: "", a: normalized.trim(), p: "" };
  }

  const sections = { s: "", o: "", a: "", p: "" };
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = (match[1] ?? "").toLowerCase();
    const sectionStart = (match.index ?? 0) + match[0].length;
    const sectionEnd = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length;
    const value = normalized.slice(sectionStart, sectionEnd).trim();
    if (!value) continue;

    if (key === "s" || key === "o" || key === "a" || key === "p") {
      sections[key] = sections[key] ? `${sections[key]}\n${value}` : value;
    }
  }

  return sections;
}

function buildReferenceText(row: Record<string, string>): string {
  return [
    row.gold_human_note ?? "",
    row.transcript_expanded ?? "",
    row.extracted_json ?? "",
  ]
    .join("\n")
    .trim();
}

function normalizePlanEntityToken(rawToken: string): string | null {
  const token = rawToken.trim();
  if (!token) return null;
  if (/^\d+$/u.test(token)) return null;
  if (/^(?:mg|ml|mL|mm|amp|L)$/iu.test(token)) return null;

  if (/処置なし|治療なし|計画なし/u.test(token)) return "NO_TREATMENT";
  if (/様子見|経過観察/u.test(token)) return "OBSERVATION";
  if (/再検|再鑑定|再検査/u.test(token)) return "RECHECK";

  if (PLAN_ENTITY_STOPWORDS.has(token)) return null;
  if (/^(?:投与|実施|計画|予定|確認|記載)$/u.test(token)) return null;

  return token;
}

function extractPlanEntitiesFromText(text: string): Set<string> {
  const entities = new Set<string>();
  if (!text.trim()) return entities;

  for (const match of text.matchAll(PLAN_ENTITY_TOKEN_PATTERN)) {
    const token = match[0] ?? "";
    const normalized = normalizePlanEntityToken(token);
    if (!normalized) continue;
    entities.add(normalized);
  }

  return entities;
}

function parseExtractedPlanEntities(extractedJsonRaw: string): Set<string> {
  const entities = new Set<string>();
  if (!extractedJsonRaw.trim()) return entities;

  try {
    const parsed = JSON.parse(extractedJsonRaw);
    const record = isRecord(parsed) ? parsed : null;
    const plans = record && Array.isArray(record.p) ? record.p : [];
    for (const plan of plans) {
      if (!isRecord(plan)) continue;
      const name = normalizeString(plan.name);
      if (!name) continue;
      for (const entity of extractPlanEntitiesFromText(name)) {
        entities.add(entity);
      }
    }
  } catch {
    // Ignore malformed extracted_json and rely on other references.
  }

  return entities;
}

function extractedJsonHas500WithUnit(extractedJsonRaw: string): boolean {
  if (!extractedJsonRaw.trim()) return false;
  try {
    const parsed = JSON.parse(extractedJsonRaw);
    const record = isRecord(parsed) ? parsed : null;
    if (!record) return false;

    const plans = Array.isArray(record.p) ? record.p : [];
    for (const plan of plans) {
      if (!isRecord(plan)) continue;
      const dosage = normalizeString(plan.dosage);
      if (/\b500\s*(?:mg|ml|mL|mm)\b/iu.test(dosage)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function extractGoldPlanSignals(goldText: string): Set<string> {
  const signals = new Set<string>();
  if (/様子見|経過観察/iu.test(goldText)) signals.add("OBSERVATION");
  if (/再検|再鑑定|再検査/iu.test(goldText)) signals.add("RECHECK");
  if (/処置なし|治療なし|計画なし/iu.test(goldText)) signals.add("NO_TREATMENT");
  return signals;
}

function hasPlanHallucination(row: Record<string, string>, planSection: string): boolean {
  const soapEntities = extractPlanEntitiesFromText(planSection);
  const allowedEntities = new Set<string>([
    ...parseExtractedPlanEntities(row.extracted_json ?? ""),
    ...extractGoldPlanSignals(row.gold_human_note ?? ""),
  ]);

  if (soapEntities.size === 0) {
    return allowedEntities.size > 0;
  }

  const soapHasNoTreatment = soapEntities.has("NO_TREATMENT");
  const allowedHasNoTreatment = allowedEntities.has("NO_TREATMENT");

  const soapWithoutNoTreatment = [...soapEntities].filter((entity) => entity !== "NO_TREATMENT");
  const allowedWithoutNoTreatment = [...allowedEntities].filter((entity) => entity !== "NO_TREATMENT");

  if (soapHasNoTreatment && allowedWithoutNoTreatment.length > 0) {
    return true;
  }
  if (allowedHasNoTreatment && soapWithoutNoTreatment.length > 0) {
    return true;
  }

  const extra = soapWithoutNoTreatment.filter((entity) => !allowedEntities.has(entity));
  const missing = allowedWithoutNoTreatment.filter((entity) => !soapEntities.has(entity));
  return extra.length > 0 || missing.length > 0;
}

function hasDxAssertion(assessmentSection: string, goldText: string): boolean {
  const assessment = assessmentSection.trim();
  if (!assessment) return false;
  if (/評価なし|診断なし|未評価|不明/iu.test(assessment)) return false;

  const goldIsUncertain = containsAny(goldText, GOLD_UNCERTAIN_PATTERNS);
  const soapIsUncertain = containsAny(assessment, SOAP_UNCERTAIN_PATTERNS);
  const soapIsAssertive = containsAny(assessment, SOAP_ASSERTIVE_PATTERNS);
  const soapHasDiagnosisLabel = containsAny(assessment, SOAP_DIAGNOSIS_LABEL_PATTERNS);

  if (soapIsAssertive && !soapIsUncertain) return true;
  if (goldIsUncertain && soapHasDiagnosisLabel && !soapIsUncertain) return true;
  return false;
}

function hasTerminologyError(soapText: string, referenceText: string): boolean {
  if (containsAny(soapText, TERMINOLOGY_CIDR_MISUSE_PATTERNS)) return true;
  return containsAny(soapText, TERMINOLOGY_PATTERNS) && !containsAny(referenceText, TERMINOLOGY_PATTERNS);
}

function hasFactualIssue(row: Record<string, string>, soapText: string, goldText: string): boolean {
  if (!soapText.trim() || !goldText.trim()) return false;

  const converted500MilliToUnit =
    FACTUAL_GOLD_500_MILLI_PATTERN.test(goldText) &&
    FACTUAL_SOAP_500_WITH_UNIT_PATTERN.test(soapText) &&
    !FACTUAL_SOAP_500_MILLI_PATTERN.test(soapText);

  if (converted500MilliToUnit && !extractedJsonHas500WithUnit(row.extracted_json ?? "")) {
    return true;
  }

  const convertedScoreToMm =
    FACTUAL_GOLD_SCORE_PATTERN.test(goldText) &&
    FACTUAL_SOAP_MM_PATTERN.test(soapText) &&
    !FACTUAL_GOLD_MM_PATTERN.test(goldText);

  return convertedScoreToMm;
}

function classifySoapErrorType(row: Record<string, string>): {
  primary: string;
  tags: string[];
} {
  const soapText = row.soap_text ?? "";
  const goldText = row.gold_human_note ?? "";
  const sections = extractSoapSections(soapText);

  const tags: string[] = [];
  if (containsAny(soapText, PROMPT_LEAK_PATTERNS)) {
    tags.push("PROMPT_LEAK");
  }
  if (hasPlanHallucination(row, sections.p)) {
    tags.push("PLAN_HALLUCINATION");
  }
  if (hasDxAssertion(sections.a, goldText)) {
    tags.push("DX_ASSERTION");
  }
  if (hasTerminologyError(soapText, buildReferenceText(row))) {
    tags.push("TERMINOLOGY_ERROR");
  }
  if (hasFactualIssue(row, soapText, goldText)) {
    tags.push("FACTUAL_ISSUE");
  }

  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length === 0) {
    return { primary: "CLEAN", tags: [] };
  }

  const primary =
    PRIMARY_PRIORITY.find((candidate) => uniqueTags.includes(candidate)) ??
    uniqueTags[0];
  return { primary, tags: uniqueTags };
}

function summarizeClassifications(rows: Record<string, string>[]): {
  primaryCounts: Record<string, number>;
  tagCounts: Record<string, number>;
} {
  const primaryCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  for (const row of rows) {
    const primary = (row.error_type_primary ?? "CLEAN").trim() || "CLEAN";
    primaryCounts[primary] = (primaryCounts[primary] ?? 0) + 1;

    const rawTags = (row.error_tags ?? "").trim();
    if (!rawTags) continue;
    for (const tag of rawTags.split("|").map((item) => item.trim()).filter(Boolean)) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  return { primaryCounts, tagCounts };
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
