import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMasterMatchingForEvaluation,
  computeConfirmedErrorRate,
  computeEntityMetrics,
  evaluateCases,
  extractPredictedEntities,
  type EvalCase,
  type EvalEntity,
} from "../../amplify/data/handlers/evaluation";
import { resetMasterMatcherCache } from "../../amplify/data/handlers/master-matcher";

describe("evaluation metrics", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("computes entity precision/recall/f1 from predicted and gold entities", () => {
    const predicted: EvalEntity[] = [
      { type: "disease", name: "肺炎" },
      { type: "drug", name: "アンピシリン" },
    ];
    const gold: EvalEntity[] = [
      { type: "disease", name: "肺炎" },
      { type: "drug", name: "セファゾリン" },
    ];

    const metric = computeEntityMetrics(predicted, gold);

    expect(metric.tp).toBe(1);
    expect(metric.fp).toBe(1);
    expect(metric.fn).toBe(1);
    expect(metric.precision).toBe(0.5);
    expect(metric.recall).toBe(0.5);
    expect(metric.f1).toBe(0.5);
  });

  it("computes confirmed error rate from confirmed predictions only", () => {
    const predicted = [
      { type: "disease" as const, name: "肺炎", status: "confirmed" as const },
      { type: "drug" as const, name: "アンピシリン", status: "confirmed" as const },
      { type: "procedure" as const, name: "注射", status: "unconfirmed" as const },
    ];
    const gold: EvalEntity[] = [
      { type: "disease", name: "肺炎" },
      { type: "drug", name: "セファゾリン" },
    ];

    const confirmed = computeConfirmedErrorRate(predicted, gold);

    expect(confirmed.confirmed_total).toBe(2);
    expect(confirmed.confirmed_correct).toBe(1);
    expect(confirmed.confirmed_errors).toBe(1);
    expect(confirmed.confirmed_error_rate).toBe(0.5);
  });
});

describe("evaluation pipeline behavior", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("enriches canonical name for confirmed disease/drug matches", () => {
    const input = {
      vital: { temp_c: 39.8 },
      s: "食欲不振",
      o: "発熱",
      a: [{ name: "肺炎疑い" }],
      p: [{ name: "アモキシシリンLA注", type: "drug" as const }],
    };

    const enriched = applyMasterMatchingForEvaluation(input);
    const entities = extractPredictedEntities(enriched);

    expect(enriched.a[0].canonical_name).toBe("肺炎");
    expect(enriched.a[0].status).toBe("confirmed");
    expect(enriched.p[0].canonical_name).toBe("アモキシシリン油性懸濁注射液");
    expect(enriched.p[0].status).toBe("confirmed");
    expect(entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "disease", name: "肺炎", status: "confirmed" }),
        expect.objectContaining({
          type: "drug",
          name: "アモキシシリン油性懸濁注射液",
          status: "confirmed",
        }),
      ])
    );
  });

  it("evaluates cases and returns overall metrics plus confirmed error rate", () => {
    const evalCase: EvalCase = {
      id: "case-001",
      input_extracted_json: {
        vital: { temp_c: 39.8 },
        s: "食欲不振",
        o: "発熱",
        a: [{ name: "肺炎疑い" }],
        p: [{ name: "アモキシシリンLA注", type: "drug" }],
      },
      gold_entities: [
        { type: "disease", name: "肺炎" },
        { type: "drug", name: "アモキシシリン油性懸濁注射液" },
      ],
    };

    const report = evaluateCases([evalCase]);

    expect(report.case_count).toBe(1);
    expect(report.entity_metrics.overall.f1).toBe(1);
    expect(report.confirmed.confirmed_total).toBe(2);
    expect(report.confirmed.confirmed_errors).toBe(0);
    expect(report.confirmed.confirmed_error_rate).toBe(0);
  });
});
