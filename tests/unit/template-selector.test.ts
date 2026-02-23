/**
 * Unit tests for Template_Selector component
 * Feature: vet-voice-medical-record
 * Task 11.3
 *
 * Requirements: 16.2
 */

import { describe, it, expect } from "vitest";
import { selectTemplate, validateRequiredFields } from "../../amplify/data/handlers/template-selector";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";
import { getTemplate } from "../../src/lib/templates";

function makeJson(overrides: Partial<ExtractedJSON> = {}): ExtractedJSON {
  return {
    vital: { temp_c: 38.5 },
    s: null,
    o: null,
    a: [],
    p: [],
    ...overrides,
  };
}

describe("selectTemplate", () => {
  // --- reproduction_soap ---

  it('s containing "妊娠" → reproduction_soap', () => {
    const result = selectTemplate(makeJson({ s: "昨日から妊娠の確認をしたい" }));
    expect(result.selectedType).toBe("reproduction_soap");
  });

  it('s containing "分娩" → reproduction_soap', () => {
    const result = selectTemplate(makeJson({ s: "分娩後の経過確認" }));
    expect(result.selectedType).toBe("reproduction_soap");
  });

  it('a[].name containing "子宮内膜炎" → reproduction_soap (子宮 keyword)', () => {
    const result = selectTemplate(
      makeJson({ a: [{ name: "子宮内膜炎" }] })
    );
    expect(result.selectedType).toBe("reproduction_soap");
  });

  // --- hoof_soap ---

  it('s containing "跛行" → hoof_soap', () => {
    const result = selectTemplate(makeJson({ s: "右後肢の跛行が見られる" }));
    expect(result.selectedType).toBe("hoof_soap");
  });

  it('a[].name containing "蹄底潰瘍" → hoof_soap (蹄 keyword)', () => {
    const result = selectTemplate(
      makeJson({ a: [{ name: "蹄底潰瘍" }] })
    );
    expect(result.selectedType).toBe("hoof_soap");
  });

  // --- general_soap (default) ---

  it("no matching keywords → general_soap with confidence 1.0", () => {
    const result = selectTemplate(makeJson({ s: "食欲不振が続いている", o: "体温正常" }));
    expect(result.selectedType).toBe("general_soap");
    expect(result.confidence).toBe(1.0);
  });

  it("empty s/o/a/p → general_soap", () => {
    const result = selectTemplate(makeJson());
    expect(result.selectedType).toBe("general_soap");
  });

  // --- confidence ---

  it("reproduction_soap: partial keyword match → confidence < 1.0", () => {
    // reproduction_soap has 7 keywords; matching only 1 → confidence = 1/7
    const result = selectTemplate(makeJson({ s: "妊娠の確認" }));
    expect(result.selectedType).toBe("reproduction_soap");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(1.0);
  });
});

describe("validateRequiredFields", () => {
  it("all required fields present → empty array", () => {
    const template = getTemplate("general_soap")!;
    const json = makeJson({ s: "食欲不振", o: "体温38.5℃" });
    const missing = validateRequiredFields(json, template);
    expect(missing).toEqual([]);
  });

  it("missing vital.temp_c → ['vital.temp_c'] in result", () => {
    const template = getTemplate("general_soap")!;
    const json = makeJson({ vital: { temp_c: null }, s: "食欲不振", o: "体温正常" });
    const missing = validateRequiredFields(json, template);
    expect(missing).toContain("vital.temp_c");
  });

  it("missing s → ['s'] in result", () => {
    const template = getTemplate("general_soap")!;
    const json = makeJson({ s: null, o: "体温38.5℃" });
    const missing = validateRequiredFields(json, template);
    expect(missing).toContain("s");
  });
});
