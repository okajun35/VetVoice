/**
 * Unit tests: filterCows
 * Feature: cow-management-qr
 *
 * Tests concrete examples, edge cases, and error conditions.
 * Requirements: 2.2, 2.3, 2.4
 */

import { describe, it, expect } from "vitest";
import { filterCows, type CowData } from "../../src/lib/cow-filter";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeCow(overrides: Partial<CowData> & { cowId: string }): CowData {
  return {
    cowId: overrides.cowId,
    name: overrides.name ?? null,
    breed: overrides.breed ?? null,
    farm: overrides.farm ?? null,
    earTagNo: overrides.earTagNo ?? null,
    sex: overrides.sex ?? null,
    birthDate: overrides.birthDate ?? null,
    parity: overrides.parity ?? null,
    lastCalvingDate: overrides.lastCalvingDate ?? null,
    createdAt: overrides.createdAt ?? null,
    updatedAt: overrides.updatedAt ?? null,
  };
}

const COW_A = makeCow({
  cowId: "1234567890",
  name: "hanako",
  breed: "Holstein",
  farm: "yamada-farm",
});

const COW_B = makeCow({
  cowId: "0987654321",
  name: "taro",
  breed: "Jersey",
  farm: "suzuki-farm",
});

const COW_C = makeCow({
  cowId: "1111111111",
  name: null,
  breed: "wagyu",
  farm: null,
});

const SAMPLE_COWS: CowData[] = [COW_A, COW_B, COW_C];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("filterCows", () => {
  describe("empty list", () => {
    it("returns empty array when cows list is empty", () => {
      expect(filterCows([], "Holstein")).toEqual([]);
    });

    it("returns empty array when cows list is empty and query is empty", () => {
      expect(filterCows([], "")).toEqual([]);
    });
  });

  describe("empty query", () => {
    it("returns all cows when query is empty string", () => {
      const result = filterCows(SAMPLE_COWS, "");
      expect(result).toEqual(SAMPLE_COWS);
    });

    it("returns all cows when query is whitespace only", () => {
      expect(filterCows(SAMPLE_COWS, "   ")).toEqual(SAMPLE_COWS);
    });

    it("returns all cows when query is tab character", () => {
      expect(filterCows(SAMPLE_COWS, "\t")).toEqual(SAMPLE_COWS);
    });
  });

  describe("search by cowId", () => {
    it("matches exact cowId", () => {
      const result = filterCows(SAMPLE_COWS, "1234567890");
      expect(result).toEqual([COW_A]);
    });

    it("matches partial cowId", () => {
      const result = filterCows(SAMPLE_COWS, "12345");
      expect(result).toEqual([COW_A]);
    });

    it("matches cow by cowId substring shared with another cow", () => {
      // COW_C: "1111111111" contains "111"
      const result = filterCows(SAMPLE_COWS, "111");
      expect(result).toEqual([COW_C]);
    });
  });

  describe("search by name", () => {
    it("matches cow by exact name", () => {
      const result = filterCows(SAMPLE_COWS, "hanako");
      expect(result).toEqual([COW_A]);
    });

    it("matches cow by partial name", () => {
      const result = filterCows(SAMPLE_COWS, "taro");
      expect(result).toEqual([COW_B]);
    });

    it("does not match cows with null name", () => {
      // COW_C has null name; query only matches name field
      const result = filterCows([COW_C], "hanako");
      expect(result).toEqual([]);
    });
  });

  describe("search by breed", () => {
    it("matches cow by exact breed", () => {
      const result = filterCows(SAMPLE_COWS, "Jersey");
      expect(result).toEqual([COW_B]);
    });

    it("matches cow by partial breed", () => {
      const result = filterCows(SAMPLE_COWS, "Holst");
      expect(result).toEqual([COW_A]);
    });
  });

  describe("search by farm", () => {
    it("matches cow by exact farm name", () => {
      const result = filterCows(SAMPLE_COWS, "yamada-farm");
      expect(result).toEqual([COW_A]);
    });

    it("matches cow by partial farm name", () => {
      const result = filterCows(SAMPLE_COWS, "suzuki");
      expect(result).toEqual([COW_B]);
    });

    it("does not match cows with null farm", () => {
      const result = filterCows([COW_C], "yamada-farm");
      expect(result).toEqual([]);
    });
  });

  describe("case-insensitive matching", () => {
    it("matches breed with lowercase query against mixed-case value", () => {
      // COW_A has breed "Holstein"
      const result = filterCows(SAMPLE_COWS, "holstein");
      expect(result).toEqual([COW_A]);
    });

    it("matches breed with uppercase query against mixed-case value", () => {
      const result = filterCows(SAMPLE_COWS, "HOLSTEIN");
      expect(result).toEqual([COW_A]);
    });

    it("matches breed with mixed-case query", () => {
      const result = filterCows(SAMPLE_COWS, "hOlStEiN");
      expect(result).toEqual([COW_A]);
    });

    it("matches farm with different case", () => {
      const cowWithFarm = makeCow({
        cowId: "5555555555",
        farm: "Green Valley Farm",
      });
      const result = filterCows([cowWithFarm], "green valley");
      expect(result).toEqual([cowWithFarm]);
    });
  });

  describe("no matches", () => {
    it("returns empty array when no cow matches the query", () => {
      const result = filterCows(SAMPLE_COWS, "nonexistent-farm");
      expect(result).toEqual([]);
    });

    it("returns empty array when query matches no field in any cow", () => {
      const result = filterCows(SAMPLE_COWS, "zzzzzzzzzzz");
      expect(result).toEqual([]);
    });
  });

  describe("multiple matches", () => {
    it("returns all cows that match the query", () => {
      // Both COW_A and COW_B have farms containing "farm"
      const result = filterCows(SAMPLE_COWS, "farm");
      expect(result).toContain(COW_A);
      expect(result).toContain(COW_B);
      expect(result).not.toContain(COW_C);
    });
  });

  describe("result references", () => {
    it("returns references to original cow objects (not copies)", () => {
      const result = filterCows(SAMPLE_COWS, "Holstein");
      expect(result[0]).toBe(COW_A); // same reference
    });
  });
});
