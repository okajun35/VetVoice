/**
 * Master_Matcher component unit tests
 * Feature: vet-voice-medical-record
 * Task 5.2
 *
 * Requirements: 7.1, 7.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  matchDisease,
  matchProcedure,
  matchDrug,
  resetMasterMatcherCache,
  DISEASE_CONFIDENCE_THRESHOLD,
  PROCEDURE_CONFIDENCE_THRESHOLD,
  DRUG_CONFIDENCE_THRESHOLD,
} from "../../amplify/data/handlers/master-matcher";

describe("Master_Matcher: matchDisease()", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("matches '心のう炎' to byoumei master code '01-01'", () => {
    const result = matchDisease("心のう炎");

    expect(result.query).toBe("心のう炎");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].code).toBe("01-01");
    expect(result.candidates[0].master_source).toBe("byoumei");
    expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
      DISEASE_CONFIDENCE_THRESHOLD
    );
    expect(result.top_confirmed).toBe(true);
  });

  it("returns top candidate with name and code fields", () => {
    const result = matchDisease("心のう炎");

    const top = result.candidates[0];
    expect(top.name).toBeDefined();
    expect(typeof top.name).toBe("string");
    expect(top.code).toBeDefined();
    expect(typeof top.code).toBe("string");
  });

  it("returns up to 3 candidates", () => {
    const result = matchDisease("心のう炎");

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("candidates are sorted by confidence descending", () => {
    const result = matchDisease("心のう炎");

    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i].confidence).toBeLessThanOrEqual(
        result.candidates[i - 1].confidence
      );
    }
  });

  it("confidence scores are in range [0.0, 1.0]", () => {
    const result = matchDisease("心のう炎");

    for (const candidate of result.candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.0);
      expect(candidate.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it("all candidates have master_source 'byoumei'", () => {
    const result = matchDisease("心のう炎");

    for (const candidate of result.candidates) {
      expect(candidate.master_source).toBe("byoumei");
    }
  });

  it("details contain majorCode and majorName", () => {
    const result = matchDisease("心のう炎");

    const top = result.candidates[0];
    expect(top.details.majorCode).toBeDefined();
    expect(top.details.majorName).toBeDefined();
  });

  it("returns empty candidates for empty input", () => {
    const result = matchDisease("");

    expect(result.candidates).toHaveLength(0);
    expect(result.top_confirmed).toBe(false);
  });

  it("returns empty candidates for whitespace-only input", () => {
    const result = matchDisease("   ");

    expect(result.candidates).toHaveLength(0);
    expect(result.top_confirmed).toBe(false);
  });

  it("top_confirmed is false when top candidate is below threshold", () => {
    const result = matchDisease("xyzxyzxyz");

    if (
      result.candidates.length > 0 &&
      result.candidates[0].confidence < DISEASE_CONFIDENCE_THRESHOLD
    ) {
      expect(result.top_confirmed).toBe(false);
    }
  });

  it("matches '乳房炎' to a byoumei entry in category 07", () => {
    const result = matchDisease("乳房炎");

    expect(result.candidates.length).toBeGreaterThan(0);
    const topCode = result.candidates[0].code;
    expect(topCode.startsWith("07")).toBe(true);
  });

  it("matches '第四胃変位' to a byoumei entry in category 04", () => {
    const result = matchDisease("第四胃変位");

    expect(result.candidates.length).toBeGreaterThan(0);
    const topCode = result.candidates[0].code;
    expect(topCode.startsWith("04")).toBe(true);
  });

  it("normalizes suspicion suffix and matches '肺炎疑い' to '肺炎'", () => {
    const result = matchDisease("肺炎疑い");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].name).toBe("肺炎");
    expect(result.candidates[0].code).toBe("03-14");
    expect(result.top_confirmed).toBe(true);
  });

  it("normalizes speculative phrase and matches '乳房炎かと思います' to a 07 category disease", () => {
    const result = matchDisease("乳房炎かと思います");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].code.startsWith("07")).toBe(true);
    expect(result.top_confirmed).toBe(true);
  });
});

describe("Master_Matcher: matchProcedure()", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("matches '初診' to shinryo_tensu code 'S01-1'", () => {
    const result = matchProcedure("初診");

    expect(result.query).toBe("初診");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].code).toBe("S01-1");
    expect(result.candidates[0].master_source).toBe("shinryo_tensu");
    expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
      PROCEDURE_CONFIDENCE_THRESHOLD
    );
    expect(result.top_confirmed).toBe(true);
  });

  it("matches '再診' to shinryo_tensu code 'S01-2'", () => {
    const result = matchProcedure("再診");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].code).toBe("S01-2");
    expect(result.top_confirmed).toBe(true);
  });

  it("returns up to 3 candidates", () => {
    const result = matchProcedure("初診");

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("candidates are sorted by confidence descending", () => {
    const result = matchProcedure("初診");

    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i].confidence).toBeLessThanOrEqual(
        result.candidates[i - 1].confidence
      );
    }
  });

  it("confidence scores are in range [0.0, 1.0]", () => {
    const result = matchProcedure("初診");

    for (const candidate of result.candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.0);
      expect(candidate.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it("all candidates have master_source 'shinryo_tensu'", () => {
    const result = matchProcedure("初診");

    for (const candidate of result.candidates) {
      expect(candidate.master_source).toBe("shinryo_tensu");
    }
  });

  it("details contain sectionId, pointsB, pointsA", () => {
    const result = matchProcedure("初診");

    const top = result.candidates[0];
    expect(top.details.sectionId).toBeDefined();
    expect(top.details.pointsB).toBeDefined();
    expect(top.details.pointsA).toBeDefined();
  });

  it("returns empty candidates for empty input", () => {
    const result = matchProcedure("");

    expect(result.candidates).toHaveLength(0);
    expect(result.top_confirmed).toBe(false);
  });

  it("returns empty candidates for whitespace-only input", () => {
    const result = matchProcedure("   ");

    expect(result.candidates).toHaveLength(0);
    expect(result.top_confirmed).toBe(false);
  });

  it("no duplicate codes in candidates", () => {
    const result = matchProcedure("初診");

    const codes = result.candidates.map((c) => c.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe("Master_Matcher: confidence threshold behavior", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("uses per-kind thresholds", () => {
    expect(DISEASE_CONFIDENCE_THRESHOLD).toBe(0.65);
    expect(PROCEDURE_CONFIDENCE_THRESHOLD).toBe(0.85);
    expect(DRUG_CONFIDENCE_THRESHOLD).toBe(0.8);
  });

  it("matchDisease top_confirmed is true when top candidate confidence >= disease threshold", () => {
    const result = matchDisease("心のう炎");

    if (
      result.candidates.length > 0 &&
      result.candidates[0].confidence >= DISEASE_CONFIDENCE_THRESHOLD
    ) {
      expect(result.top_confirmed).toBe(true);
    }
  });

  it("matchProcedure is stricter and keeps broad term as unconfirmed", () => {
    const result = matchProcedure("注射");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].confidence).toBeLessThan(PROCEDURE_CONFIDENCE_THRESHOLD);
    expect(result.top_confirmed).toBe(false);
  });

  it("top_confirmed is false when no candidates returned", () => {
    const result = matchDisease("");
    expect(result.top_confirmed).toBe(false);
  });

  it("exact match produces high confidence score", () => {
    const result = matchDisease("心のう炎");
    expect(result.candidates[0].confidence).toBeGreaterThan(0.8);
  });

  it("exact match for procedure produces high confidence score", () => {
    const result = matchProcedure("初診");
    expect(result.candidates[0].confidence).toBeGreaterThan(0.8);
  });
});

describe("Master_Matcher: matchDrug()", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("matches generic drug name and returns drug_reference source", () => {
    const result = matchDrug("アスコルビン酸注射液");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].name).toBe("アスコルビン酸注射液");
    expect(result.candidates[0].master_source).toBe("drug_reference");
    expect(result.candidates[0].code).toBe("DRUG:アスコルビン酸注射液");
    expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(DRUG_CONFIDENCE_THRESHOLD);
    expect(result.top_confirmed).toBe(true);
  });

  it("normalizes product alias to generic_name", () => {
    const result = matchDrug("アモキシシリンLA注");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].name).toBe("アモキシシリン油性懸濁注射液");
    expect(result.top_confirmed).toBe(true);
  });

  it("normalizes 'ブドウ糖液' dictation to injectable generic", () => {
    const result = matchDrug("50%ブドウ糖液");

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].name).toBe("ブドウ糖注射液");
    expect(result.candidates[0].code).toBe("DRUG:ブドウ糖注射液");
    expect(result.top_confirmed).toBe(true);
  });

  it("returns empty candidates for empty input", () => {
    const result = matchDrug("");

    expect(result.candidates).toHaveLength(0);
    expect(result.top_confirmed).toBe(false);
  });
});
