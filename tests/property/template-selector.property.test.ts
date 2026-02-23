/**
 * Template_Selector property tests
 * Feature: vet-voice-medical-record
 * Task 11.4
 *
 * **Validates: Requirements 16.1, 16.2, 16.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { extractedJsonArb } from "../../tests/helpers/generators";
import {
  selectTemplate,
  validateRequiredFields,
} from "../../amplify/data/handlers/template-selector";
import { TEMPLATES, getTemplate } from "../../src/lib/templates";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";

// Valid TemplateType values
const VALID_TEMPLATE_TYPES = [
  "general_soap",
  "reproduction_soap",
  "hoof_soap",
  "kyosai",
] as const;

// -----------------------------------------------------------------------
// Property 15: Template definition completeness
// -----------------------------------------------------------------------
describe("Feature: vet-voice-medical-record, Property 15: テンプレート定義の網羅性", () => {
  it("TEMPLATES array contains all 4 template types", () => {
    const types = TEMPLATES.map((t) => t.type);
    for (const expected of VALID_TEMPLATE_TYPES) {
      expect(types).toContain(expected);
    }
  });

  it("each template has a non-empty label string", () => {
    for (const template of TEMPLATES) {
      expect(typeof template.label).toBe("string");
      expect(template.label.length).toBeGreaterThan(0);
    }
  });

  it("each template has a keywords array", () => {
    for (const template of TEMPLATES) {
      expect(Array.isArray(template.keywords)).toBe(true);
    }
  });

  it("general_soap and kyosai have empty keywords arrays (default / always-generated)", () => {
    const generalSoap = getTemplate("general_soap");
    const kyosai = getTemplate("kyosai");
    expect(generalSoap?.keywords).toEqual([]);
    expect(kyosai?.keywords).toEqual([]);
  });

  it("reproduction_soap and hoof_soap have non-empty keywords arrays", () => {
    const reproduction = getTemplate("reproduction_soap");
    const hoof = getTemplate("hoof_soap");
    expect(reproduction?.keywords.length).toBeGreaterThan(0);
    expect(hoof?.keywords.length).toBeGreaterThan(0);
  });

  it("getTemplate(type) returns the correct template for each type", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_TEMPLATE_TYPES), (type) => {
        const template = getTemplate(type);
        expect(template).toBeDefined();
        expect(template?.type).toBe(type);
      }),
      { numRuns: 100 }
    );
  });
});

// -----------------------------------------------------------------------
// Property 16: Template auto-selection accuracy
// -----------------------------------------------------------------------
describe("Feature: vet-voice-medical-record, Property 16: テンプレート自動選択の正確性", () => {
  it("selectTemplate always returns a valid TemplateType for any ExtractedJSON", () => {
    fc.assert(
      fc.property(extractedJsonArb, (extracted) => {
        const result = selectTemplate(extracted);
        expect(VALID_TEMPLATE_TYPES as readonly string[]).toContain(result.selectedType);
      }),
      { numRuns: 100 }
    );
  });

  it("confidence is always between 0.0 and 1.0 inclusive", () => {
    fc.assert(
      fc.property(extractedJsonArb, (extracted) => {
        const result = selectTemplate(extracted);
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it("reproduction keyword injected into s field causes reproduction_soap selection", () => {
    const reproductionKeywords = ["妊娠", "分娩", "繁殖", "発情", "授精", "妊娠鑑定", "子宮"];

    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.constantFrom(...reproductionKeywords),
        (extracted, keyword) => {
          const withKeyword: ExtractedJSON = {
            ...extracted,
            s: keyword,
          };
          const result = selectTemplate(withKeyword);
          expect(result.selectedType).toBe("reproduction_soap");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("hoof keyword injected into s field (no reproduction keywords) causes hoof_soap selection", () => {
    const hoofKeywords = ["蹄", "跛行", "蹄病", "削蹄", "蹄底", "趾皮膚炎"];

    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.constantFrom(...hoofKeywords),
        (extracted, keyword) => {
          // Clear all other text fields to avoid reproduction keyword interference
          const withKeyword: ExtractedJSON = {
            ...extracted,
            s: keyword,
            o: null,
            a: [],
            p: [],
          };
          const result = selectTemplate(withKeyword);
          expect(result.selectedType).toBe("hoof_soap");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no specific keywords in any field results in general_soap with confidence 1.0", () => {
    // ExtractedJSON with no text in any field that could match keywords
    const noKeywordArb = fc.record({
      vital: fc.record({
        temp_c: fc.oneof(
          fc.float({ min: 35.0, max: 42.0, noNaN: true }),
          fc.constant(null)
        ),
      }),
      s: fc.constant(null),
      o: fc.constant(null),
      a: fc.constant([]),
      p: fc.constant([]),
    });

    fc.assert(
      fc.property(noKeywordArb, (extracted) => {
        const result = selectTemplate(extracted);
        expect(result.selectedType).toBe("general_soap");
        expect(result.confidence).toBe(1.0);
      }),
      { numRuns: 100 }
    );
  });
});

// -----------------------------------------------------------------------
// Property 17: Missing required field notification
// -----------------------------------------------------------------------
describe("Feature: vet-voice-medical-record, Property 17: テンプレート必須フィールド欠落通知", () => {
  it("validateRequiredFields always returns an array", () => {
    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.constantFrom(...VALID_TEMPLATE_TYPES),
        (extracted, type) => {
          const template = getTemplate(type)!;
          const missing = validateRequiredFields(extracted, template);
          expect(Array.isArray(missing)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("vital.temp_c null with template requiring it results in 'vital.temp_c' in missing fields", () => {
    const templatesRequiringTemp = TEMPLATES.filter((t) =>
      t.requiredFields.includes("vital.temp_c")
    );

    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.constantFrom(...templatesRequiringTemp),
        (extracted, template) => {
          const withNullTemp: ExtractedJSON = {
            ...extracted,
            vital: { temp_c: null },
          };
          const missing = validateRequiredFields(withNullTemp, template);
          expect(missing).toContain("vital.temp_c");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("s null or empty with template requiring it results in 's' in missing fields", () => {
    const templatesRequiringS = TEMPLATES.filter((t) =>
      t.requiredFields.includes("s")
    );

    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.constantFrom(...templatesRequiringS),
        fc.oneof(fc.constant(null), fc.constant("")),
        (extracted, template, sValue) => {
          const withEmptyS: ExtractedJSON = {
            ...extracted,
            s: sValue,
          };
          const missing = validateRequiredFields(withEmptyS, template);
          expect(missing).toContain("s");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all required fields present results in empty missing array for general_soap", () => {
    const generalSoapTemplate = getTemplate("general_soap")!;

    const fullyPopulatedArb = fc.record({
      vital: fc.record({
        temp_c: fc.float({ min: 35.0, max: 42.0, noNaN: true }),
      }),
      s: fc.string({ minLength: 1 }),
      o: fc.string({ minLength: 1 }),
      a: fc.array(
        fc.record({
          name: fc.string({ minLength: 1 }),
        })
      ),
      p: fc.array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          type: fc.oneof(
            fc.constant("procedure" as const),
            fc.constant("drug" as const)
          ),
        })
      ),
    });

    fc.assert(
      fc.property(fullyPopulatedArb, (extracted) => {
        const missing = validateRequiredFields(extracted, generalSoapTemplate);
        expect(missing).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it("missingFields from selectTemplate matches validateRequiredFields for the selected template", () => {
    fc.assert(
      fc.property(extractedJsonArb, (extracted) => {
        const result = selectTemplate(extracted);
        const template = getTemplate(result.selectedType)!;
        const expectedMissing = validateRequiredFields(extracted, template);
        expect(result.missingFields).toEqual(expectedMissing);
      }),
      { numRuns: 100 }
    );
  });
});
