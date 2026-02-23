/**
 * Visit reuse logic
 * Task 26.2: reuseVisit() - copy ExtractedJSON excluding cowId/datetime/visitId
 * Requirements: 18.2, 18.4
 */

export interface VisitSnapshot {
  visitId: string;
  cowId: string;
  datetime: string;
  extractedJson?: unknown;
  templateType?: string | null;
}

export interface ReuseResult {
  extractedJson: unknown | null;
  templateType: string | null;
}

/**
 * Creates a reusable copy of a Visit's clinical data.
 * Excludes identity fields (visitId, cowId, datetime) so they can be
 * overwritten when creating a new Visit.
 *
 * @param visit - The source Visit snapshot to copy from
 * @returns ReuseResult with a deep copy of extractedJson and templateType
 */
export function reuseVisit(visit: VisitSnapshot): ReuseResult {
  const extractedJson =
    visit.extractedJson != null
      ? JSON.parse(JSON.stringify(visit.extractedJson))
      : null;

  const templateType = visit.templateType ?? null;

  return { extractedJson, templateType };
}
