/**
 * Property-based tests: filterCows
 * Feature: cow-management-qr
 *
 * Validates correctness properties (Property 1, 2, 3) from the design doc
 * using fast-check.
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { filterCows, type CowData } from "../../src/lib/cow-filter";

// ---------------------------------------------------------------------------
// Generators
// Local cowDataArb aligned with CowData (SelectionSet-derived type).
// cowIdArb is also defined locally to match the 10-digit numeric string spec.
// ---------------------------------------------------------------------------

const cowIdArb = fc.stringOf(
  fc.constantFrom(...("0123456789".split("") as string[])),
  { minLength: 10, maxLength: 10 }
);

/**
 * CowData arbitrary generator.
 * Matches SelectionSet<Schema["Cow"]["type"], ...> including nullable fields.
 */
const cowDataArb: fc.Arbitrary<CowData> = fc.record({
  cowId: cowIdArb,
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  breed: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  farm: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  earTagNo: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  sex: fc.option(
    fc.constantFrom("FEMALE" as const, "MALE" as const, "CASTRATED" as const),
    { nil: null }
  ),
  birthDate: fc.option(
    fc.date().map((d) => d.toISOString().split("T")[0]),
    { nil: null }
  ),
  parity: fc.option(fc.nat({ max: 20 }), { nil: null }),
  lastCalvingDate: fc.option(
    fc.date().map((d) => d.toISOString().split("T")[0]),
    { nil: null }
  ),
  createdAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  updatedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
}) as fc.Arbitrary<CowData>;

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Feature: cow-management-qr — filterCows property tests", () => {
  /**
   * Feature: cow-management-qr, Property 1: Filter returns only matching cows
   *
   * For any list of cows and any non-empty query string, every cow returned by
   * filterCows must contain the query string (case-insensitive) in at least one
   * of: cowId, name, breed, farm.
   *
   * Validates: Requirements 2.2
   */
  it("Property 1: should only return cows matching the query", () => {
    fc.assert(
      fc.property(
        fc.array(cowDataArb),
        fc.string({ minLength: 1 }),
        (cows, query) => {
          const result = filterCows(cows, query);
          const normalizedQuery = query.trim().toLowerCase();
          // If query is whitespace-only, filterCows returns all — trivially true
          if (!normalizedQuery) return true;
          return result.every(
            (cow) =>
              cow.cowId.toLowerCase().includes(normalizedQuery) ||
              (cow.name?.toLowerCase().includes(normalizedQuery) ?? false) ||
              (cow.breed?.toLowerCase().includes(normalizedQuery) ?? false) ||
              (cow.farm?.toLowerCase().includes(normalizedQuery) ?? false)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: cow-management-qr, Property 2: Empty query returns all cows (identity)
   *
   * For any list of cows, calling filterCows with an empty string or
   * whitespace-only query returns the original list unchanged.
   *
   * Validates: Requirements 2.3
   */
  it("Property 2: empty query should return all cows (identity)", () => {
    const emptyOrWhitespaceArb = fc.oneof(
      fc.constant(""),
      fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 5 })
    );

    fc.assert(
      fc.property(fc.array(cowDataArb), emptyOrWhitespaceArb, (cows, query) => {
        const result = filterCows(cows, query);
        return (
          result.length === cows.length &&
          result.every((cow, i) => cow === cows[i])
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: cow-management-qr, Property 3: Filter result is a subset of input
   *
   * For any list of cows and any query string, the result length is at most the
   * input length, and every cow in the result is also present in the input.
   *
   * Validates: Requirements 2.2, 2.3
   */
  it("Property 3: filter result should be a subset of the input list", () => {
    fc.assert(
      fc.property(fc.array(cowDataArb), fc.string(), (cows, query) => {
        const result = filterCows(cows, query);
        // Result must not be larger than input
        if (result.length > cows.length) return false;
        // Every element in result must exist in input (by reference)
        return result.every((cow) => cows.includes(cow));
      }),
      { numRuns: 100 }
    );
  });
});
