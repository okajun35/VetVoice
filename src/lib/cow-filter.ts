import type { Schema } from "../../amplify/data/resource";
import type { SelectionSet } from "aws-amplify/data";

// Derive CowData type from the Amplify Schema (type-only, no runtime client)
const COW_SELECTION_SET = [
  "cowId",
  "earTagNo",
  "sex",
  "breed",
  "birthDate",
  "parity",
  "lastCalvingDate",
  "name",
  "farm",
  "createdAt",
  "updatedAt",
] as const;

export type CowData = SelectionSet<Schema["Cow"]["type"], typeof COW_SELECTION_SET>;

/**
 * Filter a list of cows by a search query.
 *
 * Searches across cowId, name, breed, and farm fields using
 * case-insensitive partial matching.
 *
 * @param cows - Array of cow records to filter
 * @param query - Search string; empty/whitespace-only returns all cows
 * @returns Filtered array (subset of input)
 */
export function filterCows(cows: CowData[], query: string): CowData[] {
  if (!query.trim()) return cows;
  const normalizedQuery = query.trim().toLowerCase();
  return cows.filter(
    (cow) =>
      cow.cowId.toLowerCase().includes(normalizedQuery) ||
      (cow.name?.toLowerCase().includes(normalizedQuery) ?? false) ||
      (cow.breed?.toLowerCase().includes(normalizedQuery) ?? false) ||
      (cow.farm?.toLowerCase().includes(normalizedQuery) ?? false)
  );
}
