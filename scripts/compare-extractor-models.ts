import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { expand } from "../amplify/data/handlers/dictionary-expander";
import { extract } from "../amplify/data/handlers/extractor";
import { getModelConfig } from "../amplify/data/handlers/model-config";
import { normalizePreExtractionTextByRules } from "../amplify/data/handlers/normalization-rules";
import type { EvalEntityType } from "../amplify/data/handlers/evaluation";
import type { ExtractedJSON } from "../amplify/data/handlers/parser";
import {
  evaluateApPolicy,
  extractTranscriptTextFromJson,
  inferEncounterContext,
  type EncounterContext,
  normalizeComparisonCases,
  parseCsvRows,
  parseModelListArg,
} from "./compare-extractor-models.utils";

const DEFAULT_MODEL_IDS = [
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "amazon.nova-premier-v1:0",
  "amazon.nova-pro-v1:0",
];
const REQUIRED_FIELDS_TOTAL = 5;

interface CliOptions {
  datasetPath: string;
  outputDir: string;
  modelIds: string[];
}

interface RequestedModel {
  requestedModelId: string;
  resolvedModelId: string;
}

interface CaseStructuredGoldItem {
  type: EvalEntityType;
  name: string;
}

interface ClassificationCounts {
  missing: number;
  misclassified: number;
}

interface ModelCaseResult {
  requested_model_id: string;
  resolved_model_id: string;
  success: boolean;
  latency_ms: number;
  schema_pass: boolean;
  required_fields_filled: number;
  required_fields_total: number;
  evidence_backed_fields_filled: number;
  evidence_backed_fields_total: number;
  missing_count: number | null;
  misclassified_count: number | null;
  encounter_context: EncounterContext | null;
  procedure_uttered: boolean | null;
  p_without_utterance: boolean | null;
  a_without_p_allowed: boolean | null;
  error?: string;
  extracted_json?: ExtractedJSON;
}

interface CaseResult {
  case_id: string;
  note?: string;
  transcript_json_path?: string;
  transcript_raw: string;
  transcript_expanded: string;
  gold_human_note: string;
  structured_gold: CaseStructuredGoldItem[];
  model_results: ModelCaseResult[];
}

interface ModelAggregate {
  requested_model_id: string;
  resolved_model_id: string;
  case_count: number;
  success_count: number;
  schema_pass_rate: number;
  required_fields_fill_rate: number;
  evidence_backed_fill_rate: number;
  p_utterance_alignment_rate: number | null;
  p_without_utterance_count: number;
  a_without_p_allowed_count: number;
  repro_screening_inferred_count: number;
  missing_count_total: number | null;
  misclassified_count_total: number | null;
  avg_latency_ms: number;
}

interface ComparisonReport {
  generated_at: string;
  dataset_path: string;
  case_count: number;
  model_count: number;
  models: RequestedModel[];
  aggregates: ModelAggregate[];
  cases: CaseResult[];
}

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const outputJsonPath = path.join(options.outputDir, "comparison.latest.json");
  const outputMarkdownPath = path.join(options.outputDir, "comparison.latest.md");

  const rows = parseCsvRows(await readFile(options.datasetPath, "utf8"));
  const cases = normalizeComparisonCases(rows, options.datasetPath);
  const models = options.modelIds.map((modelId) => {
    const config = getModelConfig("extractor", false, modelId);
    return {
      requestedModelId: modelId,
      resolvedModelId: config.modelId,
    };
  });

  const caseResults: CaseResult[] = [];
  for (const inputCase of cases) {
    const transcriptRaw = inputCase.transcriptText
      ? inputCase.transcriptText
      : await loadTranscriptRawFromJsonPath(inputCase.transcriptJsonPath);
    const transcriptExpanded = normalizePreExtractionTextByRules(
      expand(transcriptRaw).expanded_text
    );

    const structuredGold = toStructuredGold(inputCase);
    const modelResults: ModelCaseResult[] = [];

    for (const model of models) {
      const startedAt = Date.now();
      try {
        const extractedJson = await extract(
          {
            expanded_text: transcriptExpanded,
            model_id_override: model.resolvedModelId,
            strict_errors: true,
          },
          bedrockClient
        );
        const latencyMs = Date.now() - startedAt;
        const apPolicy = evaluateApPolicy(transcriptExpanded, extractedJson);
        const required = countRequiredFieldFill(extractedJson);
        const evidenceBacked = countEvidenceBackedFieldFill(
          extractedJson,
          transcriptExpanded,
          apPolicy
        );
        const encounterContext = inferEncounterContext(transcriptExpanded, extractedJson);
        const classification =
          structuredGold.length > 0
            ? classifyAgainstStructuredGold(extractedJson, structuredGold)
            : null;

        modelResults.push({
          requested_model_id: model.requestedModelId,
          resolved_model_id: model.resolvedModelId,
          success: true,
          latency_ms: latencyMs,
          schema_pass: true,
          required_fields_filled: required.filled,
          required_fields_total: required.total,
          evidence_backed_fields_filled: evidenceBacked.filled,
          evidence_backed_fields_total: evidenceBacked.total,
          missing_count: classification?.missing ?? null,
          misclassified_count: classification?.misclassified ?? null,
          encounter_context: encounterContext,
          procedure_uttered: apPolicy.procedureUttered,
          p_without_utterance: apPolicy.pWithoutUtterance,
          a_without_p_allowed: apPolicy.aWithoutPAllowed,
          extracted_json: extractedJson,
        });
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : String(error);
        modelResults.push({
          requested_model_id: model.requestedModelId,
          resolved_model_id: model.resolvedModelId,
          success: false,
          latency_ms: latencyMs,
          schema_pass: false,
          required_fields_filled: 0,
          required_fields_total: REQUIRED_FIELDS_TOTAL,
          evidence_backed_fields_filled: 0,
          evidence_backed_fields_total: REQUIRED_FIELDS_TOTAL,
          missing_count: structuredGold.length > 0 ? structuredGold.length : null,
          misclassified_count: structuredGold.length > 0 ? 0 : null,
          encounter_context: null,
          procedure_uttered: null,
          p_without_utterance: null,
          a_without_p_allowed: null,
          error: message,
        });
      }
    }

    caseResults.push({
      case_id: inputCase.caseId,
      note: inputCase.note,
      transcript_json_path: inputCase.transcriptJsonPath,
      transcript_raw: transcriptRaw,
      transcript_expanded: transcriptExpanded,
      gold_human_note: inputCase.goldHumanNote,
      structured_gold: structuredGold,
      model_results: modelResults,
    });
  }

  const report: ComparisonReport = {
    generated_at: new Date().toISOString(),
    dataset_path: options.datasetPath,
    case_count: caseResults.length,
    model_count: models.length,
    models,
    aggregates: buildAggregates(models, caseResults),
    cases: caseResults,
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMarkdownPath, toMarkdown(report), "utf8");

  console.log(`Comparison complete: ${report.case_count} case(s), ${report.model_count} model(s)`);
  console.log(`Dataset: ${options.datasetPath}`);
  for (const aggregate of report.aggregates) {
    console.log(
      `${aggregate.requested_model_id}: evidence_backed_fill_rate=${aggregate.evidence_backed_fill_rate.toFixed(
        4
      )}, schema_pass_rate=${aggregate.schema_pass_rate.toFixed(
        4
      )}, required_fields_fill_rate=${aggregate.required_fields_fill_rate.toFixed(
        4
      )}, avg_latency_ms=${aggregate.avg_latency_ms.toFixed(1)}`
    );
  }
  console.log(`Saved: ${outputJsonPath}`);
  console.log(`Saved: ${outputMarkdownPath}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let modelListArg: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--models") {
      modelListArg = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--models=")) {
      modelListArg = arg.slice("--models=".length);
      continue;
    }
    positional.push(arg);
  }

  return {
    datasetPath: positional[0] ?? "tmp/model-comparison-sample.csv",
    outputDir: positional[1] ?? "tmp/model-compare",
    modelIds: parseModelListArg(modelListArg, DEFAULT_MODEL_IDS),
  };
}

async function loadTranscriptRawFromJsonPath(pathValue: string | undefined): Promise<string> {
  if (!pathValue) {
    throw new Error("transcript_json_path is missing.");
  }
  const rawJson = await readFile(pathValue, "utf8");
  return extractTranscriptTextFromJson(rawJson);
}

function toStructuredGold(inputCase: {
  goldDiseases: string[];
  goldProcedures: string[];
  goldDrugs: string[];
}): CaseStructuredGoldItem[] {
  return [
    ...inputCase.goldDiseases.map((name) => ({ type: "disease" as const, name })),
    ...inputCase.goldProcedures.map((name) => ({ type: "procedure" as const, name })),
    ...inputCase.goldDrugs.map((name) => ({ type: "drug" as const, name })),
  ];
}

function countRequiredFieldFill(extractedJson: ExtractedJSON): { filled: number; total: number } {
  let filled = 0;
  const checks = [
    extractedJson.vital.temp_c !== null,
    typeof extractedJson.s === "string" && extractedJson.s.trim().length > 0,
    typeof extractedJson.o === "string" && extractedJson.o.trim().length > 0,
    extractedJson.a.length > 0,
    extractedJson.p.length > 0,
  ];

  for (const ok of checks) {
    if (ok) filled += 1;
  }
  return { filled, total: checks.length };
}

function countEvidenceBackedFieldFill(
  extractedJson: ExtractedJSON,
  transcriptExpanded: string,
  apPolicy: {
    procedureUttered: boolean;
    pWithoutUtterance: boolean;
    aWithoutPAllowed: boolean;
  }
): { filled: number; total: number } {
  const normalizedTranscript = normalizeForEvidenceMatch(transcriptExpanded);

  const tempBacked =
    extractedJson.vital.temp_c !== null &&
    /(?:体温|temp|temps?)\s*(?:は|:|=)?\s*-?\d{2}(?:\.\d+)?/iu.test(
      normalizedTranscript
    );

  const sBacked = isNonEmptyAndGrounded(extractedJson.s, normalizedTranscript);
  const oBacked = isNonEmptyAndGrounded(extractedJson.o, normalizedTranscript);

  const aBacked =
    extractedJson.a.length > 0 &&
    extractedJson.a.some((item) =>
      isGroundedInTranscript(item.canonical_name ?? item.name, normalizedTranscript)
    );
  const pBacked =
    extractedJson.p.length > 0 && apPolicy.procedureUttered && !apPolicy.pWithoutUtterance;

  const checks = [tempBacked, sBacked, oBacked, aBacked, pBacked];
  const filled = checks.reduce((count, ok) => count + (ok ? 1 : 0), 0);
  return { filled, total: checks.length };
}

function classifyAgainstStructuredGold(
  extractedJson: ExtractedJSON,
  gold: CaseStructuredGoldItem[]
): ClassificationCounts {
  const predictedByType: Record<EvalEntityType, Set<string>> = {
    disease: new Set<string>(),
    procedure: new Set<string>(),
    drug: new Set<string>(),
  };

  for (const disease of extractedJson.a) {
    const name = normalizeEntityName(disease.canonical_name ?? disease.name);
    if (name) predictedByType.disease.add(name);
  }
  for (const plan of extractedJson.p) {
    const name = normalizeEntityName(plan.canonical_name ?? plan.name);
    if (name) predictedByType[plan.type].add(name);
  }

  let missing = 0;
  let misclassified = 0;

  for (const item of gold) {
    const normalized = normalizeEntityName(item.name);
    if (!normalized) continue;

    if (predictedByType[item.type].has(normalized)) {
      continue;
    }
    if (item.type !== "disease" && predictedByType.disease.has(normalized)) {
      misclassified += 1;
      continue;
    }
    if (item.type !== "procedure" && predictedByType.procedure.has(normalized)) {
      misclassified += 1;
      continue;
    }
    if (item.type !== "drug" && predictedByType.drug.has(normalized)) {
      misclassified += 1;
      continue;
    }
    missing += 1;
  }

  return { missing, misclassified };
}

function normalizeEntityName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function normalizeForEvidenceMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNonEmptyAndGrounded(
  value: string | null,
  normalizedTranscript: string
): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  return isGroundedInTranscript(value, normalizedTranscript);
}

function isGroundedInTranscript(value: string, normalizedTranscript: string): boolean {
  const normalized = normalizeForEvidenceMatch(value);
  if (!normalized) return false;
  return normalizedTranscript.includes(normalized);
}

function buildAggregates(models: RequestedModel[], cases: CaseResult[]): ModelAggregate[] {
  return models.map((model) => {
    let successCount = 0;
    let schemaPassCount = 0;
    let requiredFilledTotal = 0;
    let requiredTotal = 0;
    let evidenceFilledTotal = 0;
    let evidenceTotal = 0;
    let latencySum = 0;
    let pBearingCount = 0;
    let pAlignedCount = 0;
    let pWithoutUtteranceCount = 0;
    let aWithoutPAllowedCount = 0;
    let reproScreeningInferredCount = 0;

    let missingTotal = 0;
    let misclassifiedTotal = 0;
    let hasStructuredGold = false;

    for (const item of cases) {
      const result = item.model_results.find(
        (current) => current.requested_model_id === model.requestedModelId
      );
      if (!result) continue;

      if (result.success) successCount += 1;
      if (result.schema_pass) schemaPassCount += 1;
      requiredFilledTotal += result.required_fields_filled;
      requiredTotal += result.required_fields_total;
      evidenceFilledTotal += result.evidence_backed_fields_filled;
      evidenceTotal += result.evidence_backed_fields_total;
      latencySum += result.latency_ms;
      if (result.p_without_utterance !== null && result.procedure_uttered !== null) {
        const hasP = (result.extracted_json?.p.length ?? 0) > 0;
        if (hasP) {
          pBearingCount += 1;
          if (!result.p_without_utterance) {
            pAlignedCount += 1;
          }
        }
      }
      if (result.p_without_utterance) {
        pWithoutUtteranceCount += 1;
      }
      if (result.a_without_p_allowed) {
        aWithoutPAllowedCount += 1;
      }
      if (result.encounter_context === "repro_screening_inferred") {
        reproScreeningInferredCount += 1;
      }

      if (result.missing_count !== null && result.misclassified_count !== null) {
        hasStructuredGold = true;
        missingTotal += result.missing_count;
        misclassifiedTotal += result.misclassified_count;
      }
    }

    const caseCount = cases.length;
    return {
      requested_model_id: model.requestedModelId,
      resolved_model_id: model.resolvedModelId,
      case_count: caseCount,
      success_count: successCount,
      schema_pass_rate: caseCount === 0 ? 0 : schemaPassCount / caseCount,
      required_fields_fill_rate: requiredTotal === 0 ? 0 : requiredFilledTotal / requiredTotal,
      evidence_backed_fill_rate:
        evidenceTotal === 0 ? 0 : evidenceFilledTotal / evidenceTotal,
      p_utterance_alignment_rate:
        pBearingCount === 0 ? null : pAlignedCount / pBearingCount,
      p_without_utterance_count: pWithoutUtteranceCount,
      a_without_p_allowed_count: aWithoutPAllowedCount,
      repro_screening_inferred_count: reproScreeningInferredCount,
      missing_count_total: hasStructuredGold ? missingTotal : null,
      misclassified_count_total: hasStructuredGold ? misclassifiedTotal : null,
      avg_latency_ms: caseCount === 0 ? 0 : latencySum / caseCount,
    };
  });
}

function toMarkdown(report: ComparisonReport): string {
  const summaryRows = report.aggregates
    .map(
      (item) =>
        `| ${escapeCell(item.requested_model_id)} | ${escapeCell(
          item.resolved_model_id
        )} | ${item.schema_pass_rate.toFixed(4)} | ${item.required_fields_fill_rate.toFixed(
          4
        )} | ${item.evidence_backed_fill_rate.toFixed(
          4
        )} | ${item.p_utterance_alignment_rate === null ? "-" : item.p_utterance_alignment_rate.toFixed(
          4
        )} | ${item.p_without_utterance_count} | ${item.a_without_p_allowed_count} | ${item.repro_screening_inferred_count} | ${item.missing_count_total ?? "-"} | ${item.misclassified_count_total ?? "-"} | ${item.avg_latency_ms.toFixed(1)} |`
    )
    .join("\n");

  const details = report.cases
    .map((item) => {
      const modelRows = item.model_results
        .map((result) => {
          const jsonBlock = result.extracted_json
            ? `\n\`\`\`json\n${JSON.stringify(result.extracted_json, null, 2)}\n\`\`\``
            : "";
          const errorText = result.error ? `\nerror: ${result.error}` : "";
          return [
            `- model: ${result.requested_model_id} (resolved: ${result.resolved_model_id})`,
            `  - success: ${result.success}`,
            `  - schema_pass: ${result.schema_pass}`,
            `  - required_fields_fill: ${result.required_fields_filled}/${result.required_fields_total}`,
            `  - evidence_backed_fill: ${result.evidence_backed_fields_filled}/${result.evidence_backed_fields_total}`,
            `  - encounter_context: ${result.encounter_context ?? "-"}`,
            `  - procedure_uttered: ${result.procedure_uttered ?? "-"}`,
            `  - p_without_utterance: ${result.p_without_utterance ?? "-"}`,
            `  - a_without_p_allowed: ${result.a_without_p_allowed ?? "-"}`,
            `  - missing_count: ${result.missing_count ?? "-"}`,
            `  - misclassified_count: ${result.misclassified_count ?? "-"}`,
            `  - latency_ms: ${result.latency_ms}`,
            `${errorText}${jsonBlock}`,
          ].join("\n");
        })
        .join("\n");

      return [
        `## ${item.case_id}`,
        "",
        `- note: ${item.note ?? ""}`,
        `- transcript_json_path: ${item.transcript_json_path ?? ""}`,
        `- gold_human_note: ${item.gold_human_note}`,
        `- transcript_raw: ${item.transcript_raw}`,
        `- transcript_expanded: ${item.transcript_expanded}`,
        item.structured_gold.length > 0
          ? `- structured_gold: ${item.structured_gold
              .map((gold) => `${gold.type}:${gold.name}`)
              .join(", ")}`
          : "- structured_gold: (not provided)",
        "",
        modelRows,
        "",
      ].join("\n");
    })
    .join("\n");

  return [
    "# Extractor Model Comparison Report",
    "",
    `- generated_at: ${report.generated_at}`,
    `- dataset: ${report.dataset_path}`,
    `- case_count: ${report.case_count}`,
    `- model_count: ${report.model_count}`,
    "",
    "## Aggregate Metrics",
    "",
    "| model_id(requested) | model_id(resolved) | schema_pass_rate | required_fields_fill_rate | evidence_backed_fill_rate | p_utterance_alignment_rate | p_without_utterance_count | a_without_p_allowed_count | repro_screening_inferred_count | missing_count_total | misclassified_count_total | avg_latency_ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    summaryRows || "| - | - | - | - | - | - | - | - | - | - | - | - |",
    "",
    "## Per Case Output",
    "",
    details,
  ].join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Comparison failed: ${message}`);
  process.exitCode = 1;
});
