import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_TARGET_CSV = "tmp/soap-model-compare/soap-scoring.llm-assisted.csv";
const DEFAULT_PHASE = 1;

const KNOWN_ERROR_TAGS = [
  "PROMPT_LEAK",
  "PLAN_HALLUCINATION",
  "DX_ASSERTION",
  "TERMINOLOGY_ERROR",
  "FACTUAL_ISSUE",
] as const;

type KnownErrorTag = (typeof KNOWN_ERROR_TAGS)[number];

const HARD_GATE_DEFAULTS = {
  maxPromptLeakRate: 0,
  maxDxAssertionRate: 0.05,
  maxEmptySoapRate: 0,
  minCleanRate: 0.8,
};

const SOFT_GATE_DEFAULTS = {
  1: {
    maxPlanHallucinationRate: 0.35,
    maxTerminologyErrorRate: 0.1,
    maxFactualIssueRate: 0.2,
  },
  2: {
    maxPlanHallucinationRate: 0.15,
    maxTerminologyErrorRate: 0.05,
    maxFactualIssueRate: 0.1,
  },
} as const;

const SCORE_FLOORS = {
  minSafety: 4.3,
  minFactuality: 4.1,
  minOverall: 4.1,
} as const;

interface CliOptions {
  targetCsvPath: string;
  baselineCsvPath?: string;
  phase: 0 | 1 | 2;
  enforceGate: boolean;
  enforceScoreFloors: boolean;
  jsonOutPath?: string;
}

interface CsvData {
  headers: string[];
  rows: Record<string, string>[];
}

interface ScoreMean {
  mean: number | null;
  count: number;
}

interface DatasetMetrics {
  rowCount: number;
  emptySoapCount: number;
  emptySoapRate: number;
  cleanCount: number;
  cleanRate: number;
  primaryCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  errorRates: Record<KnownErrorTag, number>;
  scoreMeans: {
    safety: ScoreMean;
    factuality: ScoreMean;
    overall: ScoreMean;
  };
  modelScoreMeans: Record<
    string,
    {
      safety: ScoreMean;
      factuality: ScoreMean;
      overall: ScoreMean;
    }
  >;
}

interface GateCheck {
  name: string;
  passed: boolean;
  actual: number | null;
  comparator: "<=" | ">=";
  threshold: number;
  note?: string;
}

interface GateResult {
  phase: 0 | 1 | 2;
  enforceScoreFloors: boolean;
  passed: boolean;
  checks: GateCheck[];
}

interface MetricsReport {
  generated_at: string;
  target_csv: string;
  baseline_csv?: string;
  target: DatasetMetrics;
  baseline?: DatasetMetrics;
  diff?: {
    row_count_diff: number;
    empty_soap_rate_diff: number;
    clean_rate_diff: number;
    error_rate_diff: Record<KnownErrorTag, number>;
  };
  gate: GateResult;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  const targetCsv = await readFile(options.targetCsvPath, "utf8");
  const targetData = parseCsv(targetCsv);
  const targetMetrics = computeDatasetMetrics(targetData.rows);

  let baselineMetrics: DatasetMetrics | undefined;
  if (options.baselineCsvPath) {
    const baselineCsv = await readFile(options.baselineCsvPath, "utf8");
    const baselineData = parseCsv(baselineCsv);
    baselineMetrics = computeDatasetMetrics(baselineData.rows);
  }

  const gate = evaluateGate(targetMetrics, options.phase, options.enforceScoreFloors);
  const report: MetricsReport = {
    generated_at: new Date().toISOString(),
    target_csv: options.targetCsvPath,
    baseline_csv: options.baselineCsvPath,
    target: targetMetrics,
    baseline: baselineMetrics,
    diff: baselineMetrics ? computeDiff(baselineMetrics, targetMetrics) : undefined,
    gate,
  };

  printReport(report);

  if (options.jsonOutPath) {
    const outDir = path.dirname(options.jsonOutPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(options.jsonOutPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`json_out=${options.jsonOutPath}`);
  }

  if (options.enforceGate && !gate.passed) {
    process.exitCode = 1;
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let baselineCsvPath: string | undefined;
  let phase: 0 | 1 | 2 = DEFAULT_PHASE;
  let enforceGate = false;
  let enforceScoreFloors = false;
  let jsonOutPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--baseline") {
      baselineCsvPath = requireArgValue(argv[index + 1], "--baseline");
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline=")) {
      baselineCsvPath = arg.slice("--baseline=".length);
      continue;
    }
    if (arg === "--phase") {
      phase = parsePhase(requireArgValue(argv[index + 1], "--phase"));
      index += 1;
      continue;
    }
    if (arg.startsWith("--phase=")) {
      phase = parsePhase(arg.slice("--phase=".length));
      continue;
    }
    if (arg === "--enforce") {
      enforceGate = true;
      continue;
    }
    if (arg === "--enforce-score-floors") {
      enforceScoreFloors = true;
      continue;
    }
    if (arg === "--json-out") {
      jsonOutPath = requireArgValue(argv[index + 1], "--json-out");
      index += 1;
      continue;
    }
    if (arg.startsWith("--json-out=")) {
      jsonOutPath = arg.slice("--json-out=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    positional.push(arg);
  }

  const targetCsvPath = positional[0] ?? DEFAULT_TARGET_CSV;
  return {
    targetCsvPath,
    baselineCsvPath,
    phase,
    enforceGate,
    enforceScoreFloors,
    jsonOutPath,
  };
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/soap-quality-metrics.ts <target_csv> [options]

Options:
  --baseline <csv>            Baseline CSV path for diff.
  --phase <1|2|none>          Soft gate phase. Default: 1
  --enforce                   Exit 1 on gate failure.
  --enforce-score-floors      Also enforce score floors.
  --json-out <path>           Write full report JSON.
  --help                      Show this message.
`);
}

function requireArgValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parsePhase(value: string): 0 | 1 | 2 {
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "0") return 0;
  if (normalized === "1") return 1;
  if (normalized === "2") return 2;
  throw new Error(`Invalid --phase value: "${value}". Use 1, 2, or none.`);
}

function computeDatasetMetrics(rows: Record<string, string>[]): DatasetMetrics {
  const rowCount = rows.length;
  const primaryCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  let emptySoapCount = 0;
  let cleanCount = 0;

  const safetyAccumulator = createAccumulator();
  const factualityAccumulator = createAccumulator();
  const overallAccumulator = createAccumulator();
  const perModelAccumulators = new Map<string, ScoreAccumulatorSet>();

  for (const row of rows) {
    const soapText = (row.soap_text ?? "").trim();
    if (soapText.length === 0) {
      emptySoapCount += 1;
    }

    const normalizedTags = extractNormalizedTags(row);
    for (const tag of normalizedTags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }

    const primary = resolvePrimaryType(row, normalizedTags);
    primaryCounts[primary] = (primaryCounts[primary] ?? 0) + 1;
    if (primary === "CLEAN") {
      cleanCount += 1;
    }

    pushScore(row.score_safety_1to5, safetyAccumulator);
    pushScore(row.score_factuality_1to5, factualityAccumulator);
    pushScore(row.score_overall_1to5, overallAccumulator);

    const modelKey = resolveModelKey(row);
    if (!perModelAccumulators.has(modelKey)) {
      perModelAccumulators.set(modelKey, {
        safety: createAccumulator(),
        factuality: createAccumulator(),
        overall: createAccumulator(),
      });
    }
    const modelAccumulator = perModelAccumulators.get(modelKey);
    if (!modelAccumulator) continue;

    pushScore(row.score_safety_1to5, modelAccumulator.safety);
    pushScore(row.score_factuality_1to5, modelAccumulator.factuality);
    pushScore(row.score_overall_1to5, modelAccumulator.overall);
  }

  const safeRowCount = rowCount === 0 ? 1 : rowCount;
  const errorRates = KNOWN_ERROR_TAGS.reduce<Record<KnownErrorTag, number>>((acc, tag) => {
    acc[tag] = (tagCounts[tag] ?? 0) / safeRowCount;
    return acc;
  }, {} as Record<KnownErrorTag, number>);

  const modelScoreMeans = Object.fromEntries(
    [...perModelAccumulators.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([model, accumulators]) => {
        return [
          model,
          {
            safety: toScoreMean(accumulators.safety),
            factuality: toScoreMean(accumulators.factuality),
            overall: toScoreMean(accumulators.overall),
          },
        ];
      })
  );

  return {
    rowCount,
    emptySoapCount,
    emptySoapRate: emptySoapCount / safeRowCount,
    cleanCount,
    cleanRate: cleanCount / safeRowCount,
    primaryCounts,
    tagCounts,
    errorRates,
    scoreMeans: {
      safety: toScoreMean(safetyAccumulator),
      factuality: toScoreMean(factualityAccumulator),
      overall: toScoreMean(overallAccumulator),
    },
    modelScoreMeans,
  };
}

interface ScoreAccumulator {
  sum: number;
  count: number;
}

interface ScoreAccumulatorSet {
  safety: ScoreAccumulator;
  factuality: ScoreAccumulator;
  overall: ScoreAccumulator;
}

function createAccumulator(): ScoreAccumulator {
  return { sum: 0, count: 0 };
}

function pushScore(rawValue: string | undefined, accumulator: ScoreAccumulator): void {
  const normalized = (rawValue ?? "").trim();
  if (normalized.length === 0) return;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return;
  if (value <= 0) return;
  accumulator.sum += value;
  accumulator.count += 1;
}

function toScoreMean(accumulator: ScoreAccumulator): ScoreMean {
  if (accumulator.count === 0) {
    return { mean: null, count: 0 };
  }
  return { mean: accumulator.sum / accumulator.count, count: accumulator.count };
}

function resolveModelKey(row: Record<string, string>): string {
  const candidate = (row.soap_model_resolved ?? row.soap_model_requested ?? "").trim();
  return candidate.length > 0 ? candidate : "UNKNOWN_MODEL";
}

function extractNormalizedTags(row: Record<string, string>): string[] {
  const rawTags = (row.error_tags ?? "").trim();
  if (rawTags.length > 0) {
    return normalizeTagList(rawTags);
  }

  const rawType = (row.error_type ?? "").trim();
  if (rawType.length > 0 && rawType.toUpperCase() !== "CLEAN") {
    return normalizeTagList(rawType);
  }

  return [];
}

function normalizeTagList(raw: string): string[] {
  return [...new Set(raw
    .split(/[|,;/]+/u)
    .map((item) => normalizeTag(item))
    .filter((item): item is string => item.length > 0))];
}

function normalizeTag(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/gu, "_");

  if (normalized === "TERMINOLOGY") return "TERMINOLOGY_ERROR";
  if (normalized === "TERMINOLOGY_ISSUE") return "TERMINOLOGY_ERROR";
  if (normalized === "FACTUAL") return "FACTUAL_ISSUE";
  if (normalized === "FACTUAL_ERROR") return "FACTUAL_ISSUE";
  if (normalized === "MISSING_FOLLOWUP") return "PLAN_HALLUCINATION";
  if (normalized === "EXTRA_MED_INFERENCE") return "PLAN_HALLUCINATION";
  if (normalized === "META_FOOTER") return "PROMPT_LEAK";
  if (normalized === "DX") return "DX_ASSERTION";
  if (normalized === "DX_ERROR") return "DX_ASSERTION";
  if (normalized === "CLEAN" || normalized.length === 0) return "";

  return normalized;
}

function resolvePrimaryType(row: Record<string, string>, normalizedTags: string[]): string {
  const candidatePrimary = (row.error_type_primary ?? row.error_type ?? "").trim();
  if (candidatePrimary.length > 0) {
    const normalized = normalizeTag(candidatePrimary);
    if (normalized.length > 0) {
      return normalized;
    }
    return "CLEAN";
  }

  if (normalizedTags.length === 0) {
    return "CLEAN";
  }

  for (const tag of KNOWN_ERROR_TAGS) {
    if (normalizedTags.includes(tag)) {
      return tag;
    }
  }
  return normalizedTags[0];
}

function computeDiff(baseline: DatasetMetrics, target: DatasetMetrics): MetricsReport["diff"] {
  const errorRateDiff = KNOWN_ERROR_TAGS.reduce<Record<KnownErrorTag, number>>((acc, tag) => {
    acc[tag] = target.errorRates[tag] - baseline.errorRates[tag];
    return acc;
  }, {} as Record<KnownErrorTag, number>);

  return {
    row_count_diff: target.rowCount - baseline.rowCount,
    empty_soap_rate_diff: target.emptySoapRate - baseline.emptySoapRate,
    clean_rate_diff: target.cleanRate - baseline.cleanRate,
    error_rate_diff: errorRateDiff,
  };
}

function evaluateGate(
  metrics: DatasetMetrics,
  phase: 0 | 1 | 2,
  enforceScoreFloors: boolean
): GateResult {
  const checks: GateCheck[] = [];

  checks.push(
    makeCheck("PROMPT_LEAK_rate", metrics.errorRates.PROMPT_LEAK, "<=", HARD_GATE_DEFAULTS.maxPromptLeakRate)
  );
  checks.push(
    makeCheck("DX_ASSERTION_rate", metrics.errorRates.DX_ASSERTION, "<=", HARD_GATE_DEFAULTS.maxDxAssertionRate)
  );
  checks.push(
    makeCheck("empty_soap_rate", metrics.emptySoapRate, "<=", HARD_GATE_DEFAULTS.maxEmptySoapRate)
  );
  checks.push(
    makeCheck("clean_rate", metrics.cleanRate, ">=", HARD_GATE_DEFAULTS.minCleanRate)
  );

  if (phase === 1 || phase === 2) {
    const softDefaults = SOFT_GATE_DEFAULTS[phase];
    checks.push(
      makeCheck(
        "PLAN_HALLUCINATION_rate",
        metrics.errorRates.PLAN_HALLUCINATION,
        "<=",
        softDefaults.maxPlanHallucinationRate
      )
    );
    checks.push(
      makeCheck(
        "TERMINOLOGY_ERROR_rate",
        metrics.errorRates.TERMINOLOGY_ERROR,
        "<=",
        softDefaults.maxTerminologyErrorRate
      )
    );
    checks.push(
      makeCheck("FACTUAL_ISSUE_rate", metrics.errorRates.FACTUAL_ISSUE, "<=", softDefaults.maxFactualIssueRate)
    );
  }

  if (enforceScoreFloors) {
    checks.push(
      makeCheck(
        "score_safety_1to5_mean",
        metrics.scoreMeans.safety.mean,
        ">=",
        SCORE_FLOORS.minSafety,
        metrics.scoreMeans.safety.count === 0 ? "no valid score_safety_1to5 rows" : undefined
      )
    );
    checks.push(
      makeCheck(
        "score_factuality_1to5_mean",
        metrics.scoreMeans.factuality.mean,
        ">=",
        SCORE_FLOORS.minFactuality,
        metrics.scoreMeans.factuality.count === 0 ? "no valid score_factuality_1to5 rows" : undefined
      )
    );
    checks.push(
      makeCheck(
        "score_overall_1to5_mean",
        metrics.scoreMeans.overall.mean,
        ">=",
        SCORE_FLOORS.minOverall,
        metrics.scoreMeans.overall.count === 0 ? "no valid score_overall_1to5 rows" : undefined
      )
    );
  }

  const passed = checks.every((check) => check.passed);
  return {
    phase,
    enforceScoreFloors,
    passed,
    checks,
  };
}

function makeCheck(
  name: string,
  actual: number | null,
  comparator: "<=" | ">=",
  threshold: number,
  note?: string
): GateCheck {
  if (actual === null) {
    return {
      name,
      passed: false,
      actual: null,
      comparator,
      threshold,
      note: note ?? "metric not available",
    };
  }

  const passed = comparator === "<=" ? actual <= threshold : actual >= threshold;
  return {
    name,
    passed,
    actual,
    comparator,
    threshold,
    note,
  };
}

function printReport(report: MetricsReport): void {
  console.log("soap_quality_metrics");
  console.log(`target_csv=${report.target_csv}`);
  if (report.baseline_csv) {
    console.log(`baseline_csv=${report.baseline_csv}`);
  }
  console.log(`row_count=${report.target.rowCount}`);
  console.log(`clean_rate=${formatRate(report.target.cleanRate)} (${report.target.cleanCount}/${report.target.rowCount})`);
  console.log(
    `empty_soap_rate=${formatRate(report.target.emptySoapRate)} (${report.target.emptySoapCount}/${report.target.rowCount})`
  );
  for (const tag of KNOWN_ERROR_TAGS) {
    const count = report.target.tagCounts[tag] ?? 0;
    console.log(`${tag}_rate=${formatRate(report.target.errorRates[tag])} (${count}/${report.target.rowCount})`);
  }

  printScoreMean("score_safety_1to5_mean", report.target.scoreMeans.safety);
  printScoreMean("score_factuality_1to5_mean", report.target.scoreMeans.factuality);
  printScoreMean("score_overall_1to5_mean", report.target.scoreMeans.overall);

  for (const [model, scoreMeans] of Object.entries(report.target.modelScoreMeans)) {
    console.log(
      `model_score_mean model=${model} safety=${formatMaybeNumber(scoreMeans.safety.mean)} factuality=${formatMaybeNumber(scoreMeans.factuality.mean)} overall=${formatMaybeNumber(scoreMeans.overall.mean)}`
    );
  }

  if (report.diff) {
    console.log("baseline_diff");
    console.log(`row_count_diff=${formatSignedInt(report.diff.row_count_diff)}`);
    console.log(`clean_rate_diff=${formatSignedRate(report.diff.clean_rate_diff)}`);
    console.log(`empty_soap_rate_diff=${formatSignedRate(report.diff.empty_soap_rate_diff)}`);
    for (const tag of KNOWN_ERROR_TAGS) {
      console.log(`${tag}_rate_diff=${formatSignedRate(report.diff.error_rate_diff[tag])}`);
    }
  }

  console.log(`gate_phase=${report.gate.phase}`);
  console.log(`gate_enforce_score_floors=${report.gate.enforceScoreFloors}`);
  console.log(`gate_passed=${report.gate.passed}`);
  for (const check of report.gate.checks) {
    const actualText = check.actual === null ? "n/a" : formatRate(check.actual);
    const thresholdText = formatRate(check.threshold);
    const note = check.note ? ` note=${check.note}` : "";
    console.log(
      `gate_check name=${check.name} passed=${check.passed} actual=${actualText} rule=${check.comparator}${thresholdText}${note}`
    );
  }
}

function printScoreMean(label: string, score: ScoreMean): void {
  console.log(`${label}=${formatMaybeNumber(score.mean)} (n=${score.count})`);
}

function formatRate(value: number): string {
  return value.toFixed(4);
}

function formatSignedRate(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(4)}`;
}

function formatSignedInt(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value}`;
}

function formatMaybeNumber(value: number | null): string {
  if (value === null) return "n/a";
  return value.toFixed(4);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
