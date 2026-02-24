/**
 * Visit reuse logic
 * Task 26.2: reuseVisit() - copy ExtractedJSON excluding cowId/datetime/visitId
 * Requirements: 18.2, 18.4
 */

export interface ExtractedJSON {
  vital: { temp_c: number | null };
  s: string | null;
  o: string | null;
  a: Array<{
    name: string;
    confidence?: number;
    master_code?: string;
    status?: 'confirmed' | 'unconfirmed';
  }>;
  p: Array<{
    name: string;
    type: 'procedure' | 'drug';
    dosage?: string;
    confidence?: number;
    master_code?: string;
    status?: 'confirmed' | 'unconfirmed';
  }>;
}

export interface VisitSnapshot {
  visitId: string;
  cowId: string;
  datetime: string;
  extractedJson?: ExtractedJSON | null;
  templateType?: string | null;
}

export interface ReuseResult {
  extractedJson: ExtractedJSON | null;
  templateType: string | null;
}

/**
 * Resets all status fields in a deep-copied ExtractedJSON to undefined.
 * Ensures reused visits start in an unconfirmed state.
 */
function resetStatus(json: ExtractedJSON): ExtractedJSON {
  return {
    ...json,
    a: json.a.map(({ status: _status, ...rest }) => rest),
    p: json.p.map(({ status: _status, ...rest }) => rest),
  };
}

/**
 * Creates a reusable copy of a Visit's clinical data.
 * Excludes identity fields (visitId, cowId, datetime).
 * Resets all status fields to undefined (unconfirmed state).
 *
 * @param visit - The source Visit snapshot to copy from
 * @returns ReuseResult with a deep copy of extractedJson (status reset) and templateType
 */
export function reuseVisit(visit: VisitSnapshot): ReuseResult {
  if (visit.extractedJson == null) {
    return { extractedJson: null, templateType: visit.templateType ?? null };
  }

  // Deep copy via JSON round-trip, then reset status fields
  const deepCopy: ExtractedJSON = JSON.parse(JSON.stringify(visit.extractedJson));
  const extractedJson = resetStatus(deepCopy);

  return { extractedJson, templateType: visit.templateType ?? null };
}
