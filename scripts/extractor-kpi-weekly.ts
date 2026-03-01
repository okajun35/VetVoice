import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_COMPARISON_JSON_PATH = "tmp/model-compare/comparison.latest.json";
const DEFAULT_WEEKLY_TARGET = 0.5;
const DEFAULT_WEEKLY_PRIMARY_METRIC = "evidence_backed_fill_rate_context_aware";

type KpiMetric =
  | "evidence_backed_fill_rate"
  | "evidence_backed_fill_rate_context_aware";

interface CliOptions {
  comparisonJsonPath: string;
  outputDir: string;
  historyPath?: string;
  target: number;
  targetModelId?: string;
  metric: KpiMetric;
  failOnBelowTarget: boolean;
}

interface ComparisonAggregate {
  requested_model_id: string;
  resolved_model_id: string;
  case_count: number;
  schema_pass_rate: number;
  required_fields_fill_rate: number;
  evidence_backed_fill_rate: number;
  evidence_backed_fill_rate_context_aware?: number;
  p_utterance_alignment_rate: number | null;
  p_without_utterance_count: number;
  a_without_p_allowed_count: number;
  avg_latency_ms: number;
}

interface ComparisonReport {
  generated_at: string;
  dataset_path: string;
  case_count: number;
  aggregates: ComparisonAggregate[];
}

interface WeeklyKpiModel {
  requested_model_id: string;
  resolved_model_id: string;
  schema_pass_rate: number;
  required_fields_fill_rate: number;
  evidence_backed_fill_rate: number;
  evidence_backed_fill_rate_context_aware: number;
  p_utterance_alignment_rate: number | null;
  p_without_utterance_count: number;
  a_without_p_allowed_count: number;
  avg_latency_ms: number;
}

interface WeeklyKpiRun {
  recorded_at: string;
  report_generated_at: string;
  dataset_path: string;
  case_count: number;
  models: WeeklyKpiModel[];
}

interface WeeklyKpiHistory {
  primary_metric: KpiMetric;
  target: number;
  runs: WeeklyKpiRun[];
}

interface LatestModelSummary extends WeeklyKpiModel {
  metric_value: number;
  delta_from_previous: number | null;
  target_pass: boolean;
}

const HISTORY_SCHEMA_VERSION = "v2";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const report = await loadComparisonReport(options.comparisonJsonPath, options.metric);
  const outputDir = options.outputDir;
  const historyPath =
    options.historyPath ?? path.join(outputDir, `kpi.weekly.history.${HISTORY_SCHEMA_VERSION}.json`);
  const markdownPath = path.join(outputDir, "kpi.weekly.latest.md");

  const nextRun = toWeeklyRun(report);
  const history = await loadWeeklyHistory(historyPath, options.target, options.metric);
  history.primary_metric = options.metric;
  history.target = options.target;
  history.runs.push(nextRun);

  const latestSummary = buildLatestModelSummary(history, options.metric);
  await mkdir(outputDir, { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, buildMarkdown(history, latestSummary, options), "utf8");

  console.log("Weekly KPI update complete");
  console.log(`Comparison input: ${options.comparisonJsonPath}`);
  console.log(`History output: ${historyPath}`);
  console.log(`Markdown output: ${markdownPath}`);
  for (const item of latestSummary) {
    const deltaLabel =
      item.delta_from_previous === null ? "-" : formatSigned(item.delta_from_previous, 4);
    console.log(
      `${item.requested_model_id}: ${options.metric}=${item.metric_value.toFixed(
        4
      )}, delta=${deltaLabel}, target_pass=${item.target_pass}`
    );
  }

  if (!options.failOnBelowTarget) {
    return;
  }

  const targets = selectTargetModels(latestSummary, options.targetModelId);
  const failed = targets.filter((item) => !item.target_pass);
  if (failed.length > 0) {
    const targetLabel = options.targetModelId
      ? `target_model=${options.targetModelId}`
      : "all models";
    throw new Error(
      `Weekly KPI target failed (${targetLabel}, metric=${options.metric}, threshold=${options.target.toFixed(
        4
      )}): ${failed
        .map((item) => item.requested_model_id)
        .join(", ")}`
    );
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let target = DEFAULT_WEEKLY_TARGET;
  let historyPath: string | undefined;
  let targetModelId: string | undefined;
  let metric: KpiMetric = DEFAULT_WEEKLY_PRIMARY_METRIC;
  let failOnBelowTarget = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      target = parseTarget(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = parseTarget(arg.slice("--target=".length));
      continue;
    }
    if (arg === "--history") {
      historyPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--history=")) {
      historyPath = arg.slice("--history=".length);
      continue;
    }
    if (arg === "--target-model") {
      targetModelId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--target-model=")) {
      targetModelId = arg.slice("--target-model=".length);
      continue;
    }
    if (arg === "--fail-on-below-target") {
      failOnBelowTarget = true;
      continue;
    }
    if (arg === "--metric") {
      metric = parseMetric(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--metric=")) {
      metric = parseMetric(arg.slice("--metric=".length));
      continue;
    }
    positional.push(arg);
  }

  const comparisonJsonPath = positional[0] ?? DEFAULT_COMPARISON_JSON_PATH;
  const outputDir = positional[1] ?? path.dirname(comparisonJsonPath);
  return {
    comparisonJsonPath,
    outputDir,
    historyPath,
    target,
    targetModelId,
    metric,
    failOnBelowTarget,
  };
}

function parseMetric(value: string | undefined): KpiMetric {
  if (!value) {
    throw new Error("Missing value for --metric");
  }
  if (
    value === "evidence_backed_fill_rate" ||
    value === "evidence_backed_fill_rate_context_aware"
  ) {
    return value;
  }
  throw new Error(
    `Invalid --metric value: "${value}". Use evidence_backed_fill_rate or evidence_backed_fill_rate_context_aware.`
  );
}

function parseTarget(value: string | undefined): number {
  if (!value) {
    throw new Error("Missing value for --target");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid --target value: "${value}". Must be a number between 0 and 1.`);
  }
  return parsed;
}

async function loadComparisonReport(
  filePath: string,
  metric: KpiMetric
): Promise<ComparisonReport> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ComparisonReport>;

  if (!parsed || !Array.isArray(parsed.aggregates)) {
    throw new Error(`Invalid comparison report JSON: ${filePath}`);
  }

  const hasMetric = parsed.aggregates.every(
    (item) => typeof item?.evidence_backed_fill_rate === "number"
  );
  if (!hasMetric) {
    throw new Error(
      `comparison JSON does not include evidence_backed_fill_rate. Re-run compare script first: ${filePath}`
    );
  }
  if (
    metric === "evidence_backed_fill_rate_context_aware" &&
    !parsed.aggregates.every(
      (item) => typeof item?.evidence_backed_fill_rate_context_aware === "number"
    )
  ) {
    throw new Error(
      `comparison JSON does not include evidence_backed_fill_rate_context_aware. Re-run compare script first: ${filePath}`
    );
  }

  return {
    generated_at: parsed.generated_at ?? new Date().toISOString(),
    dataset_path: parsed.dataset_path ?? "",
    case_count: parsed.case_count ?? 0,
    aggregates: parsed.aggregates as ComparisonAggregate[],
  };
}

function toWeeklyRun(report: ComparisonReport): WeeklyKpiRun {
  const models: WeeklyKpiModel[] = report.aggregates.map((item) => ({
    requested_model_id: item.requested_model_id,
    resolved_model_id: item.resolved_model_id,
    schema_pass_rate: item.schema_pass_rate,
    required_fields_fill_rate: item.required_fields_fill_rate,
    evidence_backed_fill_rate: item.evidence_backed_fill_rate,
    evidence_backed_fill_rate_context_aware:
      item.evidence_backed_fill_rate_context_aware ?? item.evidence_backed_fill_rate,
    p_utterance_alignment_rate: item.p_utterance_alignment_rate,
    p_without_utterance_count: item.p_without_utterance_count,
    a_without_p_allowed_count: item.a_without_p_allowed_count,
    avg_latency_ms: item.avg_latency_ms,
  }));

  return {
    recorded_at: new Date().toISOString(),
    report_generated_at: report.generated_at,
    dataset_path: report.dataset_path,
    case_count: report.case_count,
    models,
  };
}

async function loadWeeklyHistory(
  filePath: string,
  target: number,
  metric: KpiMetric
): Promise<WeeklyKpiHistory> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WeeklyKpiHistory>;
    if (!parsed || !isMetric(parsed.primary_metric) || !Array.isArray(parsed.runs)) {
      throw new Error("invalid history format");
    }
    return {
      primary_metric: parsed.primary_metric,
      target: typeof parsed.target === "number" ? parsed.target : target,
      runs: parsed.runs as WeeklyKpiRun[],
    };
  } catch (error) {
    if (isNoEntryError(error)) {
      return {
        primary_metric: metric,
        target,
        runs: [],
      };
    }
    throw error;
  }
}

function isNoEntryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function isMetric(value: unknown): value is KpiMetric {
  return (
    value === "evidence_backed_fill_rate" ||
    value === "evidence_backed_fill_rate_context_aware"
  );
}

function metricValue(model: WeeklyKpiModel, metric: KpiMetric): number {
  return metric === "evidence_backed_fill_rate"
    ? model.evidence_backed_fill_rate
    : model.evidence_backed_fill_rate_context_aware;
}

function buildLatestModelSummary(
  history: WeeklyKpiHistory,
  metric: KpiMetric
): LatestModelSummary[] {
  const latestRun = history.runs[history.runs.length - 1];
  if (!latestRun) return [];

  return latestRun.models
    .map((model) => {
      const previous = findPreviousModel(history.runs, model.requested_model_id);
      const delta =
        previous === null
          ? null
          : metricValue(model, metric) - metricValue(previous, metric);
      return {
        ...model,
        metric_value: metricValue(model, metric),
        delta_from_previous: delta,
        target_pass: metricValue(model, metric) >= history.target,
      };
    })
    .sort((left, right) => right.metric_value - left.metric_value);
}

function findPreviousModel(runs: WeeklyKpiRun[], modelId: string): WeeklyKpiModel | null {
  for (let index = runs.length - 2; index >= 0; index -= 1) {
    const found = runs[index].models.find((model) => model.requested_model_id === modelId);
    if (found) return found;
  }
  return null;
}

function buildMarkdown(
  history: WeeklyKpiHistory,
  latestSummary: LatestModelSummary[],
  options: CliOptions
): string {
  const latestRun = history.runs[history.runs.length - 1];
  const rows = latestSummary
    .map((item) => {
      const deltaLabel =
        item.delta_from_previous === null ? "-" : formatSigned(item.delta_from_previous, 4);
      const alignmentLabel =
        item.p_utterance_alignment_rate === null
          ? "-"
          : item.p_utterance_alignment_rate.toFixed(4);
      const targetLabel = item.target_pass ? "PASS" : "FAIL";
      return `| ${escapeCell(item.requested_model_id)} | ${escapeCell(
        item.resolved_model_id
      )} | ${item.metric_value.toFixed(4)} | ${deltaLabel} | ${targetLabel} | ${item.evidence_backed_fill_rate.toFixed(
        4
      )} | ${item.evidence_backed_fill_rate_context_aware.toFixed(
        4
      )} | ${item.schema_pass_rate.toFixed(
        4
      )} | ${item.required_fields_fill_rate.toFixed(
        4
      )} | ${alignmentLabel} | ${item.p_without_utterance_count} | ${item.a_without_p_allowed_count} | ${item.avg_latency_ms.toFixed(
        1
      )} |`;
    })
    .join("\n");

  const targetModels = selectTargetModels(latestSummary, options.targetModelId);
  const passCount = targetModels.filter((item) => item.target_pass).length;
  const targetScope = options.targetModelId ? `model=${options.targetModelId}` : "all_models";
  const targetStatus =
    targetModels.length === 0
      ? "NO_TARGET_MODEL_MATCH"
      : passCount === targetModels.length
      ? "PASS"
      : "FAIL";

  return [
    "# Extractor Weekly KPI",
    "",
    `- primary_metric: ${options.metric}`,
    `- target_threshold: ${history.target.toFixed(4)}`,
    `- target_scope: ${targetScope}`,
    `- target_status: ${targetStatus}`,
    `- latest_recorded_at: ${latestRun?.recorded_at ?? "-"}`,
    `- report_generated_at: ${latestRun?.report_generated_at ?? "-"}`,
    `- dataset_path: ${latestRun?.dataset_path ?? "-"}`,
    `- case_count: ${latestRun?.case_count ?? 0}`,
    `- history_runs: ${history.runs.length}`,
    "",
    "運用メモ:",
    "- 週次KPIの主指標は `--metric` で選択（推奨: `evidence_backed_fill_rate_context_aware`）。",
    "- `required_fields_fill_rate` は補助指標（埋まりやすさ確認）として保持。",
    "",
    "## Latest Model KPI",
    "",
    "| model_id(requested) | model_id(resolved) | selected_metric_value | delta_from_previous | target_status | evidence_backed_fill_rate | evidence_backed_fill_rate_context_aware | schema_pass_rate | required_fields_fill_rate | p_utterance_alignment_rate | p_without_utterance_count | a_without_p_allowed_count | avg_latency_ms |",
    "| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    rows || "| - | - | - | - | - | - | - | - | - | - | - | - | - |",
    "",
  ].join("\n");
}

function selectTargetModels(
  latestSummary: LatestModelSummary[],
  targetModelId: string | undefined
): LatestModelSummary[] {
  if (!targetModelId) return latestSummary;
  return latestSummary.filter((item) => item.requested_model_id === targetModelId);
}

function formatSigned(value: number, digits: number): string {
  const formatted = value.toFixed(digits);
  if (value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Weekly KPI update failed: ${message}`);
  process.exitCode = 1;
});
