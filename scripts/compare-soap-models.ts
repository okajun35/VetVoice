import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { expand } from "../amplify/data/handlers/dictionary-expander";
import { extract } from "../amplify/data/handlers/extractor";
import { getModelConfig } from "../amplify/data/handlers/model-config";
import { normalizePreExtractionTextByRules } from "../amplify/data/handlers/normalization-rules";
import type { ExtractedJSON } from "../amplify/data/handlers/parser";
import { generateSOAP } from "../amplify/data/handlers/soap-generator";
import { selectTemplate, type TemplateType } from "../amplify/data/handlers/template-selector";
import {
  extractTranscriptTextFromJson,
  parseCsvRows,
  parseModelListArg,
} from "./compare-extractor-models.utils";

const DEFAULT_SOAP_MODEL_IDS = ["amazon.nova-lite-v1:0", "zai.glm-4.7"];
const DEFAULT_EXTRACTOR_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0";
const TEMPLATE_TYPES: TemplateType[] = [
  "general_soap",
  "reproduction_soap",
  "hoof_soap",
  "kyosai",
];

interface CliOptions {
  datasetPath: string;
  outputDir: string;
  soapModelIds: string[];
  extractorModelId: string;
}

interface SoapComparisonCaseInput {
  caseId: string;
  transcriptJsonPath?: string;
  transcriptText?: string;
  goldHumanNote: string;
  templateType?: TemplateType;
  note?: string;
}

interface RequestedModel {
  requestedModelId: string;
  resolvedModelId: string;
}

interface SoapModelCaseResult {
  requested_model_id: string;
  resolved_model_id: string;
  success: boolean;
  latency_ms: number;
  has_unconfirmed: boolean | null;
  is_empty: boolean;
  soap_text?: string;
  error?: string;
}

interface SoapCaseResult {
  case_id: string;
  note?: string;
  transcript_json_path?: string;
  transcript_raw: string;
  transcript_expanded: string;
  gold_human_note: string;
  template_type: TemplateType;
  extractor_model_requested: string;
  extractor_model_resolved: string;
  extraction_success: boolean;
  extraction_error?: string;
  extracted_json?: ExtractedJSON;
  model_results: SoapModelCaseResult[];
}

interface SoapModelAggregate {
  requested_model_id: string;
  resolved_model_id: string;
  case_count: number;
  success_rate: number;
  empty_soap_rate: number;
  has_unconfirmed_rate: number | null;
  avg_latency_ms: number;
  avg_soap_chars: number;
}

interface SoapComparisonReport {
  generated_at: string;
  dataset_path: string;
  case_count: number;
  model_count: number;
  extractor_model_requested: string;
  extractor_model_resolved: string;
  models: RequestedModel[];
  aggregates: SoapModelAggregate[];
  cases: SoapCaseResult[];
}

interface ScoringCsvRow {
  case_id: string;
  note: string;
  transcript_json_path: string;
  gold_human_note: string;
  template_type: TemplateType;
  extractor_model_resolved: string;
  soap_model_requested: string;
  soap_model_resolved: string;
  transcript_expanded: string;
  extracted_json: string;
  soap_text: string;
  score_factuality_1to5: string;
  score_completeness_1to5: string;
  score_readability_1to5: string;
  score_safety_1to5: string;
  score_overall_1to5: string;
  score_rank_1best: string;
  review_comment: string;
}

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const outputJsonPath = path.join(options.outputDir, "soap-comparison.latest.json");
  const outputMarkdownPath = path.join(options.outputDir, "soap-comparison.latest.md");
  const outputScoringCsvPath = path.join(options.outputDir, "soap-scoring.template.csv");

  const rows = parseCsvRows(await readFile(options.datasetPath, "utf8"));
  const cases = normalizeSoapComparisonCases(rows, options.datasetPath);
  const soapModels = options.soapModelIds.map((modelId) => {
    const config = getModelConfig("soapGenerator", false, modelId);
    return {
      requestedModelId: modelId,
      resolvedModelId: config.modelId,
    };
  });
  const extractorConfig = getModelConfig("extractor", false, options.extractorModelId);

  const caseResults: SoapCaseResult[] = [];
  for (const inputCase of cases) {
    const transcriptRaw = inputCase.transcriptText
      ? inputCase.transcriptText
      : await loadTranscriptRawFromJsonPath(inputCase.transcriptJsonPath);
    const transcriptExpanded = normalizePreExtractionTextByRules(
      expand(transcriptRaw).expanded_text
    );

    let extractionSuccess = false;
    let extractionError: string | undefined;
    let extractedJson: ExtractedJSON | undefined;
    let templateType: TemplateType = inputCase.templateType ?? "general_soap";

    try {
      extractedJson = await extract(
        {
          expanded_text: transcriptExpanded,
          model_id_override: extractorConfig.modelId,
          strict_errors: true,
        },
        bedrockClient
      );
      extractionSuccess = true;
      if (!inputCase.templateType) {
        templateType = selectTemplate(extractedJson, { contextText: transcriptExpanded }).selectedType;
      }
    } catch (error) {
      extractionError = error instanceof Error ? error.message : String(error);
    }

    const modelResults: SoapModelCaseResult[] = [];
    for (const model of soapModels) {
      if (!extractionSuccess || !extractedJson) {
        modelResults.push({
          requested_model_id: model.requestedModelId,
          resolved_model_id: model.resolvedModelId,
          success: false,
          latency_ms: 0,
          has_unconfirmed: null,
          is_empty: true,
          error: `Extractor failed: ${extractionError ?? "unknown"}`,
        });
        continue;
      }

      const startedAt = Date.now();
      try {
        const output = await generateSOAP(
          {
            extracted_json: extractedJson,
            template_type: templateType,
            model_id_override: model.resolvedModelId,
          },
          bedrockClient
        );
        const soapText = output.soap_text ?? "";
        modelResults.push({
          requested_model_id: model.requestedModelId,
          resolved_model_id: model.resolvedModelId,
          success: true,
          latency_ms: Date.now() - startedAt,
          has_unconfirmed: output.has_unconfirmed,
          is_empty: soapText.trim().length === 0,
          soap_text: soapText,
        });
      } catch (error) {
        modelResults.push({
          requested_model_id: model.requestedModelId,
          resolved_model_id: model.resolvedModelId,
          success: false,
          latency_ms: Date.now() - startedAt,
          has_unconfirmed: null,
          is_empty: true,
          error: error instanceof Error ? error.message : String(error),
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
      template_type: templateType,
      extractor_model_requested: options.extractorModelId,
      extractor_model_resolved: extractorConfig.modelId,
      extraction_success: extractionSuccess,
      extraction_error: extractionError,
      extracted_json: extractedJson,
      model_results: modelResults,
    });
  }

  const report: SoapComparisonReport = {
    generated_at: new Date().toISOString(),
    dataset_path: options.datasetPath,
    case_count: caseResults.length,
    model_count: soapModels.length,
    extractor_model_requested: options.extractorModelId,
    extractor_model_resolved: extractorConfig.modelId,
    models: soapModels,
    aggregates: buildAggregates(soapModels, caseResults),
    cases: caseResults,
  };

  const scoringCsv = buildScoringCsvRows(report);

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMarkdownPath, toMarkdown(report), "utf8");
  await writeFile(outputScoringCsvPath, toScoringCsv(scoringCsv), "utf8");

  console.log(`SOAP comparison complete: ${report.case_count} case(s), ${report.model_count} model(s)`);
  console.log(`Dataset: ${options.datasetPath}`);
  console.log(
    `Extractor model: requested=${report.extractor_model_requested}, resolved=${report.extractor_model_resolved}`
  );
  for (const aggregate of report.aggregates) {
    console.log(
      `${aggregate.requested_model_id}: success_rate=${aggregate.success_rate.toFixed(
        4
      )}, empty_soap_rate=${aggregate.empty_soap_rate.toFixed(
        4
      )}, avg_latency_ms=${aggregate.avg_latency_ms.toFixed(1)}`
    );
  }
  console.log(`Saved: ${outputJsonPath}`);
  console.log(`Saved: ${outputMarkdownPath}`);
  console.log(`Saved: ${outputScoringCsvPath}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let modelListArg: string | undefined;
  let extractorModelId = DEFAULT_EXTRACTOR_MODEL_ID;

  for (let i = 0; i < argv.length; i += 1) {
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
    if (arg === "--extractor-model") {
      extractorModelId = (argv[i + 1] ?? "").trim() || DEFAULT_EXTRACTOR_MODEL_ID;
      i += 1;
      continue;
    }
    if (arg.startsWith("--extractor-model=")) {
      extractorModelId =
        arg.slice("--extractor-model=".length).trim() || DEFAULT_EXTRACTOR_MODEL_ID;
      continue;
    }
    positional.push(arg);
  }

  return {
    datasetPath: positional[0] ?? "tmp/soap-model-comparison-sample.40.csv",
    outputDir: positional[1] ?? "tmp/soap-model-compare",
    soapModelIds: parseModelListArg(modelListArg, DEFAULT_SOAP_MODEL_IDS),
    extractorModelId,
  };
}

function normalizeSoapComparisonCases(
  rows: Array<{ lineNo: number; values: Record<string, string> }>,
  datasetPath: string
): SoapComparisonCaseInput[] {
  const datasetDir = path.dirname(datasetPath);
  const seenCaseIds = new Set<string>();

  return rows.map((row, index) => {
    const transcriptJsonPathRaw = row.values.transcript_json_path ?? "";
    const transcriptText = row.values.transcript_text ?? "";
    const goldHumanNote = row.values.gold_human_note ?? "";
    const caseId = (row.values.case_id || `case-${String(index + 1).padStart(3, "0")}`).trim();
    const templateRaw = (row.values.template_type ?? "").trim();

    if (!caseId) {
      throw new Error(`Line ${row.lineNo}: case_id resolved to empty value.`);
    }
    if (seenCaseIds.has(caseId)) {
      throw new Error(`Line ${row.lineNo}: duplicated case_id '${caseId}'.`);
    }
    seenCaseIds.add(caseId);
    if (!goldHumanNote) {
      throw new Error(`Line ${row.lineNo}: gold_human_note is required.`);
    }
    if (!transcriptJsonPathRaw && !transcriptText) {
      throw new Error(`Line ${row.lineNo}: set transcript_json_path or transcript_text.`);
    }

    const templateType = resolveTemplateType(templateRaw, row.lineNo);
    const transcriptJsonPath = transcriptJsonPathRaw
      ? path.isAbsolute(transcriptJsonPathRaw)
        ? transcriptJsonPathRaw
        : path.resolve(datasetDir, transcriptJsonPathRaw)
      : undefined;

    return {
      caseId,
      transcriptJsonPath,
      transcriptText: transcriptText || undefined,
      goldHumanNote,
      templateType,
      note: row.values.note || undefined,
    };
  });
}

function resolveTemplateType(value: string, lineNo: number): TemplateType | undefined {
  if (!value) return undefined;
  if (TEMPLATE_TYPES.includes(value as TemplateType)) {
    return value as TemplateType;
  }
  throw new Error(
    `Line ${lineNo}: invalid template_type '${value}'. Allowed: ${TEMPLATE_TYPES.join(", ")}`
  );
}

async function loadTranscriptRawFromJsonPath(pathValue: string | undefined): Promise<string> {
  if (!pathValue) {
    throw new Error("transcript_json_path is missing.");
  }
  const rawJson = await readFile(pathValue, "utf8");
  return extractTranscriptTextFromJson(rawJson);
}

function buildAggregates(
  models: RequestedModel[],
  cases: SoapCaseResult[]
): SoapModelAggregate[] {
  return models.map((model) => {
    let successCount = 0;
    let emptyCount = 0;
    let hasUnconfirmedCount = 0;
    let hasUnconfirmedDenominator = 0;
    let latencyTotal = 0;
    let charsTotal = 0;

    for (const item of cases) {
      const result = item.model_results.find(
        (current) => current.requested_model_id === model.requestedModelId
      );
      if (!result) continue;

      if (result.success) successCount += 1;
      if (result.is_empty) emptyCount += 1;
      if (result.has_unconfirmed !== null) {
        hasUnconfirmedDenominator += 1;
        if (result.has_unconfirmed) hasUnconfirmedCount += 1;
      }
      latencyTotal += result.latency_ms;
      charsTotal += (result.soap_text ?? "").length;
    }

    const caseCount = cases.length;
    return {
      requested_model_id: model.requestedModelId,
      resolved_model_id: model.resolvedModelId,
      case_count: caseCount,
      success_rate: caseCount === 0 ? 0 : successCount / caseCount,
      empty_soap_rate: caseCount === 0 ? 0 : emptyCount / caseCount,
      has_unconfirmed_rate:
        hasUnconfirmedDenominator === 0 ? null : hasUnconfirmedCount / hasUnconfirmedDenominator,
      avg_latency_ms: caseCount === 0 ? 0 : latencyTotal / caseCount,
      avg_soap_chars: caseCount === 0 ? 0 : charsTotal / caseCount,
    };
  });
}

function toMarkdown(report: SoapComparisonReport): string {
  const summaryRows = report.aggregates
    .map(
      (item) =>
        `| ${escapeCell(item.requested_model_id)} | ${escapeCell(
          item.resolved_model_id
        )} | ${item.success_rate.toFixed(4)} | ${item.empty_soap_rate.toFixed(4)} | ${
          item.has_unconfirmed_rate === null ? "-" : item.has_unconfirmed_rate.toFixed(4)
        } | ${item.avg_latency_ms.toFixed(1)} | ${item.avg_soap_chars.toFixed(1)} |`
    )
    .join("\n");

  const details = report.cases
    .map((item) => {
      const modelRows = item.model_results
        .map((result) => {
          const textBlock = result.soap_text
            ? `\n\`\`\`text\n${result.soap_text}\n\`\`\``
            : "";
          const errorText = result.error ? `\nerror: ${result.error}` : "";
          return [
            `- model: ${result.requested_model_id} (resolved: ${result.resolved_model_id})`,
            `  - success: ${result.success}`,
            `  - is_empty: ${result.is_empty}`,
            `  - has_unconfirmed: ${result.has_unconfirmed ?? "-"}`,
            `  - latency_ms: ${result.latency_ms}`,
            `${errorText}${textBlock}`,
          ].join("\n");
        })
        .join("\n");
      const extractedJsonBlock = item.extracted_json
        ? `\n\`\`\`json\n${JSON.stringify(item.extracted_json, null, 2)}\n\`\`\``
        : "";

      return [
        `## ${item.case_id}`,
        "",
        `- note: ${item.note ?? ""}`,
        `- transcript_json_path: ${item.transcript_json_path ?? ""}`,
        `- gold_human_note: ${item.gold_human_note}`,
        `- template_type: ${item.template_type}`,
        `- extraction_success: ${item.extraction_success}`,
        item.extraction_error ? `- extraction_error: ${item.extraction_error}` : "",
        `- transcript_raw: ${item.transcript_raw}`,
        `- transcript_expanded: ${item.transcript_expanded}`,
        extractedJsonBlock,
        "",
        modelRows,
        "",
      ]
        .filter((line) => line !== "")
        .join("\n");
    })
    .join("\n");

  return [
    "# SOAP Model Comparison Report",
    "",
    `- generated_at: ${report.generated_at}`,
    `- dataset: ${report.dataset_path}`,
    `- case_count: ${report.case_count}`,
    `- model_count: ${report.model_count}`,
    `- extractor_model_requested: ${report.extractor_model_requested}`,
    `- extractor_model_resolved: ${report.extractor_model_resolved}`,
    "",
    "## Aggregate Metrics",
    "",
    "| model_id(requested) | model_id(resolved) | success_rate | empty_soap_rate | has_unconfirmed_rate | avg_latency_ms | avg_soap_chars |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    summaryRows || "| - | - | - | - | - | - | - |",
    "",
    "## Per Case Output",
    "",
    details,
  ].join("\n");
}

function buildScoringCsvRows(report: SoapComparisonReport): ScoringCsvRow[] {
  const rows: ScoringCsvRow[] = [];
  for (const item of report.cases) {
    for (const result of item.model_results) {
      rows.push({
        case_id: item.case_id,
        note: item.note ?? "",
        transcript_json_path: item.transcript_json_path ?? "",
        gold_human_note: item.gold_human_note,
        template_type: item.template_type,
        extractor_model_resolved: item.extractor_model_resolved,
        soap_model_requested: result.requested_model_id,
        soap_model_resolved: result.resolved_model_id,
        transcript_expanded: item.transcript_expanded,
        extracted_json: item.extracted_json ? JSON.stringify(item.extracted_json) : "",
        soap_text: result.soap_text ?? "",
        score_factuality_1to5: "",
        score_completeness_1to5: "",
        score_readability_1to5: "",
        score_safety_1to5: "",
        score_overall_1to5: "",
        score_rank_1best: "",
        review_comment: result.error ?? "",
      });
    }
  }
  return rows;
}

function toScoringCsv(rows: ScoringCsvRow[]): string {
  const headers: Array<keyof ScoringCsvRow> = [
    "case_id",
    "note",
    "transcript_json_path",
    "gold_human_note",
    "template_type",
    "extractor_model_resolved",
    "soap_model_requested",
    "soap_model_resolved",
    "transcript_expanded",
    "extracted_json",
    "soap_text",
    "score_factuality_1to5",
    "score_completeness_1to5",
    "score_readability_1to5",
    "score_safety_1to5",
    "score_overall_1to5",
    "score_rank_1best",
    "review_comment",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function toCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SOAP comparison failed: ${message}`);
  process.exitCode = 1;
});
