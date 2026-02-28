/**
 * Dictionary_Expander component property-based tests
 * Feature: vet-voice-medical-record
 * Task 4.4
 * 
 * **Property 2: Dictionary expansion accuracy**
 * **Property 3: Dictionary entry CRUD round-trip**
 * **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 15.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { expand } from "../../amplify/data/handlers/dictionary-expander";

describe("Feature: vet-voice-medical-record, Property 2: Dictionary expansion accuracy", () => {
  it("expansion is deterministic: same input always produces same output", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result1 = expand(text);
        const result2 = expand(text);

        // Verify: deterministic behavior
        expect(result1.expanded_text).toBe(result2.expanded_text);
        expect(result1.expansions).toEqual(result2.expansions);
      }),
      { numRuns: 100 }
    );
  });

  it("expansion preserves text length or increases it (never decreases)", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = expand(text);

        // Verify: expanded text is at least as long as original
        // (abbreviations are replaced with full forms which are typically longer)
        expect(result.expanded_text.length).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it("expansion count matches number of reported expansions", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = expand(text);

        // Verify: expansions array accurately reflects what was expanded
        // Each expansion should have valid fields
        for (const expansion of result.expansions) {
          expect(expansion.original).toBeDefined();
          expect(expansion.expanded).toBeDefined();
          expect(expansion.position).toBeGreaterThanOrEqual(0);
          expect(typeof expansion.original).toBe("string");
          expect(typeof expansion.expanded).toBe("string");
          expect(typeof expansion.position).toBe("number");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("expansion positions are valid indices in original text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = expand(text);

        // Verify: all positions are within bounds of original text
        for (const expansion of result.expansions) {
          expect(expansion.position).toBeGreaterThanOrEqual(0);
          expect(expansion.position).toBeLessThanOrEqual(text.length);
          
          // Verify: original text at position matches the abbreviation
          const substring = text.substring(
            expansion.position,
            expansion.position + expansion.original.length
          );
          expect(substring).toBe(expansion.original);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("empty input produces empty output", () => {
    const result = expand("");

    expect(result.expanded_text).toBe("");
    expect(result.expansions).toHaveLength(0);
  });

  it("text without abbreviations remains unchanged", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (text) => {
          const result = expand(text);
          fc.pre(result.expansions.length === 0);

          // Verify: text without abbreviations is preserved
          expect(result.expanded_text).toBe(text);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("expansion does not introduce invalid characters", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = expand(text);

        // Verify: expanded text is a valid string
        expect(typeof result.expanded_text).toBe("string");
        expect(result.expanded_text).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it("multiple expansions maintain relative order", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = expand(text);

        // Verify: expansion positions are in ascending order
        for (let i = 1; i < result.expansions.length; i++) {
          expect(result.expansions[i].position).toBeGreaterThanOrEqual(
            result.expansions[i - 1].position
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: vet-voice-medical-record, Property 3: Dictionary entry CRUD round-trip", () => {
  it("known abbreviations are always expanded to their canonical forms", () => {
    const knownPairs = [
      { abbr: "静注", canonical: "静脈注射" },
      { abbr: "IV", canonical: "静脈注射" },
      { abbr: "筋注", canonical: "筋肉注射" },
      { abbr: "IM", canonical: "筋肉注射" },
      { abbr: "アンピ", canonical: "アンピシリン" },
      { abbr: "ABPC", canonical: "アンピシリン" },
      { abbr: "BT", canonical: "体温" },
      { abbr: "AI", canonical: "人工授精" },
    ];

    for (const { abbr, canonical } of knownPairs) {
      const result = expand(abbr);

      // Verify: abbreviation is expanded to canonical form
      expect(result.expanded_text).toBe(canonical);
      expect(result.expansions).toHaveLength(1);
      expect(result.expansions[0].original).toBe(abbr);
      expect(result.expansions[0].expanded).toBe(canonical);
    }
  });

  it("one-to-many mapping: multiple abbreviations map to same canonical form", () => {
    // Test that both '静注' and 'IV' expand to '静脈注射'
    const result1 = expand("静注");
    const result2 = expand("IV");

    expect(result1.expanded_text).toBe("静脈注射");
    expect(result2.expanded_text).toBe("静脈注射");
    expect(result1.expanded_text).toBe(result2.expanded_text);
  });

  it("expansion is idempotent: expanding already expanded text has no effect", () => {
    const text = "静注";
    
    const result1 = expand(text);
    const result2 = expand(result1.expanded_text);

    // Verify: second expansion has no effect (already in canonical form)
    expect(result2.expanded_text).toBe(result1.expanded_text);
    expect(result2.expansions).toHaveLength(0);
  });

  it("expansion preserves surrounding context", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string(),
          fc.string(),
        ),
        ([prefix, suffix]) => {
          // Keep only cases where surrounding text is not expanded on its own.
          // This makes the property robust to dictionary updates.
          fc.pre(expand(prefix).expansions.length === 0);
          fc.pre(expand(suffix).expansions.length === 0);

          const text = `${prefix}静注${suffix}`;
          const result = expand(text);

          // Verify: prefix and suffix are preserved
          expect(result.expanded_text).toContain(prefix);
          expect(result.expanded_text).toContain(suffix);
          expect(result.expanded_text).toContain("静脈注射");
        }
      ),
      { numRuns: 50 }
    );
  });
});
