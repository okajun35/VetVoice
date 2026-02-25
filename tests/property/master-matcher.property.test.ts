/**
 * Master_Matcher component property-based tests
 * Feature: vet-voice-medical-record
 * Task 5.3
 *
 * **Property 4: マスタ照合の候補提示**
 * **Property 5: Confidence閾値によるUnconfirmedマーク**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 15.5**
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  matchDisease,
  matchProcedure,
  matchDrug,
  resetMasterMatcherCache,
  DISEASE_CONFIDENCE_THRESHOLD,
  PROCEDURE_CONFIDENCE_THRESHOLD,
  DRUG_CONFIDENCE_THRESHOLD,
} from "../../amplify/data/handlers/master-matcher";

// Arbitrary for non-empty strings (at least 1 non-whitespace character)
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0);

function normalizeQuery(text: string): string {
  return text
    .normalize("NFKC")
    .trim()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[()（）\u005b\u005d［］「」『』、。・,:;'"`]/g, "")
    .replace(/[?？]+$/g, "");
}

describe("Feature: vet-voice-medical-record, Property 4: マスタ照合の候補提示", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("matchDisease: any non-empty query returns 1-3 candidates", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);
        const normalized = normalizeQuery(query);

        // Queries composed only of punctuation normalize to empty and may yield zero results.
        expect(result.candidates.length).toBeGreaterThanOrEqual(
          normalized.length === 0 ? 0 : 1
        );
        expect(result.candidates.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: any non-empty query returns 1-3 candidates", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);
        const normalized = normalizeQuery(query);

        // Queries composed only of punctuation normalize to empty and may yield zero results.
        expect(result.candidates.length).toBeGreaterThanOrEqual(
          normalized.length === 0 ? 0 : 1
        );
        expect(result.candidates.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: candidates are sorted by confidence descending", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);

        for (let i = 1; i < result.candidates.length; i++) {
          expect(result.candidates[i].confidence).toBeLessThanOrEqual(
            result.candidates[i - 1].confidence
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: candidates are sorted by confidence descending", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);

        for (let i = 1; i < result.candidates.length; i++) {
          expect(result.candidates[i].confidence).toBeLessThanOrEqual(
            result.candidates[i - 1].confidence
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: all candidates have valid confidence in [0.0, 1.0]", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);

        for (const candidate of result.candidates) {
          expect(candidate.confidence).toBeGreaterThanOrEqual(0.0);
          expect(candidate.confidence).toBeLessThanOrEqual(1.0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: all candidates have valid confidence in [0.0, 1.0]", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);

        for (const candidate of result.candidates) {
          expect(candidate.confidence).toBeGreaterThanOrEqual(0.0);
          expect(candidate.confidence).toBeLessThanOrEqual(1.0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: all candidates have required fields (name, code, master_source, details)", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);

        for (const candidate of result.candidates) {
          expect(typeof candidate.name).toBe("string");
          expect(candidate.name.length).toBeGreaterThan(0);
          expect(typeof candidate.code).toBe("string");
          expect(candidate.code.length).toBeGreaterThan(0);
          expect(candidate.master_source).toBe("byoumei");
          expect(typeof candidate.details).toBe("object");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: all candidates have required fields (name, code, master_source, details)", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);

        for (const candidate of result.candidates) {
          expect(typeof candidate.name).toBe("string");
          expect(candidate.name.length).toBeGreaterThan(0);
          expect(typeof candidate.code).toBe("string");
          expect(candidate.code.length).toBeGreaterThan(0);
          expect(candidate.master_source).toBe("shinryo_tensu");
          expect(typeof candidate.details).toBe("object");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: query field in result always equals the input", () => {
    fc.assert(
      fc.property(fc.string(), (query) => {
        const result = matchDisease(query);
        expect(result.query).toBe(query);
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: query field in result always equals the input", () => {
    fc.assert(
      fc.property(fc.string(), (query) => {
        const result = matchProcedure(query);
        expect(result.query).toBe(query);
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: matching is deterministic (same input produces same output)", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result1 = matchDisease(query);
        const result2 = matchDisease(query);

        expect(result1.candidates.length).toBe(result2.candidates.length);
        for (let i = 0; i < result1.candidates.length; i++) {
          expect(result1.candidates[i].code).toBe(result2.candidates[i].code);
          expect(result1.candidates[i].confidence).toBe(result2.candidates[i].confidence);
        }
        expect(result1.top_confirmed).toBe(result2.top_confirmed);
      }),
      { numRuns: 50 }
    );
  });

  it("matchProcedure: matching is deterministic (same input produces same output)", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result1 = matchProcedure(query);
        const result2 = matchProcedure(query);

        expect(result1.candidates.length).toBe(result2.candidates.length);
        for (let i = 0; i < result1.candidates.length; i++) {
          expect(result1.candidates[i].code).toBe(result2.candidates[i].code);
          expect(result1.candidates[i].confidence).toBe(result2.candidates[i].confidence);
        }
        expect(result1.top_confirmed).toBe(result2.top_confirmed);
      }),
      { numRuns: 50 }
    );
  });
});

describe("Feature: vet-voice-medical-record, Property 5: Confidence閾値によるUnconfirmedマーク", () => {
  beforeEach(() => {
    resetMasterMatcherCache();
  });

  it("matchDisease: top_confirmed is true iff top candidate confidence >= DISEASE_CONFIDENCE_THRESHOLD", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);

        if (result.candidates.length === 0) {
          expect(result.top_confirmed).toBe(false);
        } else {
          const topConfidence = result.candidates[0].confidence;
          if (topConfidence >= DISEASE_CONFIDENCE_THRESHOLD) {
            expect(result.top_confirmed).toBe(true);
          } else {
            expect(result.top_confirmed).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: top_confirmed is true iff top candidate confidence >= PROCEDURE_CONFIDENCE_THRESHOLD", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);

        if (result.candidates.length === 0) {
          expect(result.top_confirmed).toBe(false);
        } else {
          const topConfidence = result.candidates[0].confidence;
          if (topConfidence >= PROCEDURE_CONFIDENCE_THRESHOLD) {
            expect(result.top_confirmed).toBe(true);
          } else {
            expect(result.top_confirmed).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: empty input always produces top_confirmed=false and no candidates", () => {
    const emptyInputs = ["", "   ", "\t", "\n"];
    for (const input of emptyInputs) {
      const result = matchDisease(input);
      expect(result.top_confirmed).toBe(false);
      expect(result.candidates).toHaveLength(0);
    }
  });

  it("matchProcedure: empty input always produces top_confirmed=false and no candidates", () => {
    const emptyInputs = ["", "   ", "\t", "\n"];
    for (const input of emptyInputs) {
      const result = matchProcedure(input);
      expect(result.top_confirmed).toBe(false);
      expect(result.candidates).toHaveLength(0);
    }
  });

  it("matchDisease: if top_confirmed is true, top confidence must be >= threshold", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDisease(query);

        if (result.top_confirmed) {
          expect(result.candidates.length).toBeGreaterThan(0);
          expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
            DISEASE_CONFIDENCE_THRESHOLD
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchProcedure: if top_confirmed is true, top confidence must be >= threshold", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchProcedure(query);

        if (result.top_confirmed) {
          expect(result.candidates.length).toBeGreaterThan(0);
          expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
            PROCEDURE_CONFIDENCE_THRESHOLD
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matchDisease: exact known entries always produce top_confirmed=true", () => {
    // These are exact middle-category names with no minor sub-category in byoumei.csv
    // (stored verbatim as the searchable name — no minor entry exists for these)
    const knownDiseases = ["心のう炎", "創傷性心のう炎", "心臓肥大", "心臓破裂", "心臓弁膜病"];

    for (const disease of knownDiseases) {
      const result = matchDisease(disease);
      expect(result.top_confirmed).toBe(true);
      expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
        DISEASE_CONFIDENCE_THRESHOLD
      );
    }
  });

  it("matchProcedure: exact known entries always produce top_confirmed=true", () => {
    const knownProcedures = ["初診", "再診"];

    for (const proc of knownProcedures) {
      const result = matchProcedure(proc);
      expect(result.top_confirmed).toBe(true);
      expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
        PROCEDURE_CONFIDENCE_THRESHOLD
      );
    }
  });

  it("matchDrug: if top_confirmed is true, top confidence must be >= drug threshold", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (query) => {
        const result = matchDrug(query);

        if (result.top_confirmed) {
          expect(result.candidates.length).toBeGreaterThan(0);
          expect(result.candidates[0].confidence).toBeGreaterThanOrEqual(
            DRUG_CONFIDENCE_THRESHOLD
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
