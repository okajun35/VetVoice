import { matchDisease, matchDrug, matchProcedure } from "./master-matcher";
import type { ExtractedJSON } from "./parser";

export type EvalEntityType = "disease" | "procedure" | "drug";

export interface EvalEntity {
  type: EvalEntityType;
  name: string;
}

export interface EvalCase {
  id: string;
  note?: string;
  input_extracted_json: ExtractedJSON;
  gold_entities: EvalEntity[];
}

export interface EntityMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ConfirmedErrorMetrics {
  confirmed_total: number;
  confirmed_correct: number;
  confirmed_errors: number;
  confirmed_error_rate: number;
}

export interface CaseEvaluation {
  id: string;
  note?: string;
  entity_metrics: {
    overall: EntityMetrics;
    by_type: Record<EvalEntityType, EntityMetrics>;
  };
  confirmed: ConfirmedErrorMetrics;
}

export interface EvaluationReport {
  generated_at: string;
  case_count: number;
  entity_metrics: {
    overall: EntityMetrics;
    by_type: Record<EvalEntityType, EntityMetrics>;
  };
  confirmed: ConfirmedErrorMetrics;
  per_case: CaseEvaluation[];
}

interface PredictedEntity extends EvalEntity {
  status?: "confirmed" | "unconfirmed";
}

const ENTITY_TYPES: EvalEntityType[] = ["disease", "procedure", "drug"];

export function evaluateCases(cases: EvalCase[]): EvaluationReport {
  const per_case: CaseEvaluation[] = [];
  const predictedAll: EvalEntity[] = [];
  const goldAll: EvalEntity[] = [];
  let confirmedTotal = 0;
  let confirmedCorrect = 0;
  let confirmedErrors = 0;

  for (const evalCase of cases) {
    const enriched = applyMasterMatchingForEvaluation(evalCase.input_extracted_json);
    const predictedDetailed = extractPredictedEntities(enriched);
    const predicted = predictedDetailed.map(({ type, name }) => ({ type, name }));
    const gold = evalCase.gold_entities;

    const overall = computeEntityMetrics(predicted, gold);
    const by_type: Record<EvalEntityType, EntityMetrics> = {
      disease: computeEntityMetrics(
        predicted.filter((item) => item.type === "disease"),
        gold.filter((item) => item.type === "disease")
      ),
      procedure: computeEntityMetrics(
        predicted.filter((item) => item.type === "procedure"),
        gold.filter((item) => item.type === "procedure")
      ),
      drug: computeEntityMetrics(
        predicted.filter((item) => item.type === "drug"),
        gold.filter((item) => item.type === "drug")
      ),
    };
    const confirmed = computeConfirmedErrorRate(predictedDetailed, gold);

    per_case.push({
      id: evalCase.id,
      note: evalCase.note,
      entity_metrics: { overall, by_type },
      confirmed,
    });

    predictedAll.push(...predicted);
    goldAll.push(...gold);
    confirmedTotal += confirmed.confirmed_total;
    confirmedCorrect += confirmed.confirmed_correct;
    confirmedErrors += confirmed.confirmed_errors;
  }

  const report: EvaluationReport = {
    generated_at: new Date().toISOString(),
    case_count: cases.length,
    entity_metrics: {
      overall: computeEntityMetrics(predictedAll, goldAll),
      by_type: {
        disease: computeEntityMetrics(
          predictedAll.filter((item) => item.type === "disease"),
          goldAll.filter((item) => item.type === "disease")
        ),
        procedure: computeEntityMetrics(
          predictedAll.filter((item) => item.type === "procedure"),
          goldAll.filter((item) => item.type === "procedure")
        ),
        drug: computeEntityMetrics(
          predictedAll.filter((item) => item.type === "drug"),
          goldAll.filter((item) => item.type === "drug")
        ),
      },
    },
    confirmed: {
      confirmed_total: confirmedTotal,
      confirmed_correct: confirmedCorrect,
      confirmed_errors: confirmedErrors,
      confirmed_error_rate: roundRatio(confirmedTotal === 0 ? 0 : confirmedErrors / confirmedTotal),
    },
    per_case,
  };

  return report;
}

export function applyMasterMatchingForEvaluation(extractedJson: ExtractedJSON): ExtractedJSON {
  const enrichedA = extractedJson.a.map((item) => {
    const result = matchDisease(item.name);
    const top = result.candidates[0];

    if (!top || top.confidence <= 0) {
      return item;
    }

    return {
      ...item,
      ...(result.top_confirmed ? { canonical_name: top.name } : {}),
      confidence: top.confidence,
      master_code: top.code,
      status: result.top_confirmed ? ("confirmed" as const) : ("unconfirmed" as const),
    };
  });

  const enrichedP = extractedJson.p.map((item) => {
    const result =
      item.type === "procedure"
        ? matchProcedure(item.name)
        : item.type === "drug"
          ? matchDrug(item.name)
          : null;

    if (!result) {
      return item;
    }

    const top = result.candidates[0];
    if (!top || top.confidence <= 0) {
      return item;
    }

    return {
      ...item,
      ...(result.top_confirmed ? { canonical_name: top.name } : {}),
      confidence: top.confidence,
      master_code: top.code,
      status: result.top_confirmed ? ("confirmed" as const) : ("unconfirmed" as const),
    };
  });

  return {
    ...extractedJson,
    a: enrichedA,
    p: enrichedP,
  };
}

export function extractPredictedEntities(extractedJson: ExtractedJSON): PredictedEntity[] {
  const aEntities: PredictedEntity[] = extractedJson.a
    .map((item) => ({
      type: "disease" as const,
      name: item.canonical_name ?? item.name,
      status: item.status,
    }))
    .filter((item) => normalizeEntityName(item.name).length > 0);

  const pEntities: PredictedEntity[] = extractedJson.p
    .map((item) => ({
      type: item.type,
      name: item.canonical_name ?? item.name,
      status: item.status,
    }))
    .filter((item) => normalizeEntityName(item.name).length > 0);

  return [...aEntities, ...pEntities];
}

export function computeEntityMetrics(predicted: EvalEntity[], gold: EvalEntity[]): EntityMetrics {
  const predictedCounts = toCountMap(predicted);
  const goldCounts = toCountMap(gold);
  const predictedTotal = sumCounts(predictedCounts);
  const goldTotal = sumCounts(goldCounts);

  let tp = 0;
  for (const [key, predictedCount] of predictedCounts.entries()) {
    const goldCount = goldCounts.get(key) ?? 0;
    tp += Math.min(predictedCount, goldCount);
  }

  const fp = predictedTotal - tp;
  const fn = goldTotal - tp;

  const precision =
    predictedTotal === 0 ? (goldTotal === 0 ? 1 : 0) : tp / predictedTotal;
  const recall = goldTotal === 0 ? (predictedTotal === 0 ? 1 : 0) : tp / goldTotal;
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    tp,
    fp,
    fn,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1),
  };
}

export function computeConfirmedErrorRate(
  predictedDetailed: PredictedEntity[],
  gold: EvalEntity[]
): ConfirmedErrorMetrics {
  const goldCounts = toCountMap(gold);
  let confirmed_total = 0;
  let confirmed_correct = 0;

  for (const predicted of predictedDetailed) {
    if (predicted.status !== "confirmed") continue;

    confirmed_total++;
    const key = toEntityKey(predicted.type, predicted.name);
    if (!key) continue;

    const remain = goldCounts.get(key) ?? 0;
    if (remain > 0) {
      confirmed_correct++;
      goldCounts.set(key, remain - 1);
    }
  }

  const confirmed_errors = confirmed_total - confirmed_correct;

  return {
    confirmed_total,
    confirmed_correct,
    confirmed_errors,
    confirmed_error_rate: roundRatio(
      confirmed_total === 0 ? 0 : confirmed_errors / confirmed_total
    ),
  };
}

function toCountMap(entities: EvalEntity[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entity of entities) {
    const key = toEntityKey(entity.type, entity.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function toEntityKey(type: EvalEntityType, name: string): string | null {
  if (!ENTITY_TYPES.includes(type)) return null;
  const normalized = normalizeEntityName(name);
  if (!normalized) return null;
  return `${type}:${normalized}`;
}

function normalizeEntityName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[()（）\u005b\u005d［］「」『』、。・,:;'"`]/g, "");
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function sumCounts(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) {
    total += value;
  }
  return total;
}
