import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  evaluateCases,
  type EvalCase,
  type EvaluationReport,
  type EntityMetrics,
  type EvalEntityType,
} from "../amplify/data/handlers/evaluation";

interface EvaluationOutput {
  dataset_path: string;
  report: EvaluationReport;
}

async function main(): Promise<void> {
  const datasetPath = process.argv[2] ?? "assets/eval/gold.v1.jsonl";
  const outputDir = process.argv[3] ?? "tmp/eval";
  const outputJsonPath = path.join(outputDir, "latest.json");
  const outputMarkdownPath = path.join(outputDir, "latest.md");

  const cases = await loadDataset(datasetPath);
  const report = evaluateCases(cases);

  await mkdir(outputDir, { recursive: true });

  const outputPayload: EvaluationOutput = {
    dataset_path: datasetPath,
    report,
  };
  await writeFile(outputJsonPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
  await writeFile(outputMarkdownPath, toMarkdown(datasetPath, report), "utf8");

  console.log(`Evaluation complete: ${cases.length} case(s)`);
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Overall F1: ${report.entity_metrics.overall.f1.toFixed(4)}`);
  console.log(
    `Confirmed error rate: ${report.confirmed.confirmed_error_rate.toFixed(4)} (${report.confirmed.confirmed_errors}/${report.confirmed.confirmed_total})`
  );
  console.log(`Saved: ${outputJsonPath}`);
  console.log(`Saved: ${outputMarkdownPath}`);
}

async function loadDataset(datasetPath: string): Promise<EvalCase[]> {
  const raw = await readFile(datasetPath, "utf8");
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const cases: EvalCase[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const parsed = JSON.parse(line) as EvalCase;
      validateCase(parsed, i + 1);
      cases.push(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid dataset line ${i + 1}: ${message}`);
    }
  }

  return cases;
}

function validateCase(evalCase: EvalCase, lineNo: number): void {
  if (!evalCase || typeof evalCase !== "object") {
    throw new Error(`Line ${lineNo} must be a JSON object`);
  }
  if (!evalCase.id || typeof evalCase.id !== "string") {
    throw new Error(`Line ${lineNo} must include string field 'id'`);
  }
  if (!evalCase.input_extracted_json || typeof evalCase.input_extracted_json !== "object") {
    throw new Error(`Line ${lineNo} must include object field 'input_extracted_json'`);
  }
  if (!Array.isArray(evalCase.gold_entities)) {
    throw new Error(`Line ${lineNo} must include array field 'gold_entities'`);
  }
}

function toMarkdown(datasetPath: string, report: EvaluationReport): string {
  const rows = [
    buildMetricRow("overall", report.entity_metrics.overall),
    buildMetricRow("disease", report.entity_metrics.by_type.disease),
    buildMetricRow("procedure", report.entity_metrics.by_type.procedure),
    buildMetricRow("drug", report.entity_metrics.by_type.drug),
  ];

  const caseRows = report.per_case
    .map((item) =>
      `| ${item.id} | ${escapeCell(item.note ?? "")} | ${item.entity_metrics.overall.f1.toFixed(
        4
      )} | ${item.confirmed.confirmed_error_rate.toFixed(4)} |`
    )
    .join("\n");

  return [
    "# Evaluation Report",
    "",
    `- generated_at: ${report.generated_at}`,
    `- dataset: ${datasetPath}`,
    `- case_count: ${report.case_count}`,
    "",
    "## Entity Metrics",
    "",
    "| type | precision | recall | f1 | tp | fp | fn |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Confirmed Error Rate",
    "",
    `- confirmed_total: ${report.confirmed.confirmed_total}`,
    `- confirmed_correct: ${report.confirmed.confirmed_correct}`,
    `- confirmed_errors: ${report.confirmed.confirmed_errors}`,
    `- confirmed_error_rate: ${report.confirmed.confirmed_error_rate.toFixed(4)}`,
    "",
    "## Per Case",
    "",
    "| case_id | note | f1 | confirmed_error_rate |",
    "| --- | --- | ---: | ---: |",
    caseRows || "| - | - | - | - |",
    "",
  ].join("\n");
}

function buildMetricRow(type: EvalEntityType | "overall", metric: EntityMetrics): string {
  return `| ${type} | ${metric.precision.toFixed(4)} | ${metric.recall.toFixed(
    4
  )} | ${metric.f1.toFixed(4)} | ${metric.tp} | ${metric.fp} | ${metric.fn} |`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Evaluation failed: ${message}`);
  process.exitCode = 1;
});
