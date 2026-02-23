/**
 * Visit data integrity guard
 * Feature: vet-voice-medical-record
 * Task 15.2
 *
 * Ensures that transcriptRaw and extractedJson are never overwritten with
 * null/empty values once they have been set (Source of Truth protection).
 *
 * Requirements: 10.5, 12.3, 12.4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of Visit fields that are protected as Source of Truth */
export interface VisitSourceOfTruth {
  transcriptRaw?: string | null;
  extractedJson?: string | null;
}

/** Proposed update payload for a Visit record */
export interface VisitUpdatePayload {
  transcriptRaw?: string | null;
  extractedJson?: string | null;
  [key: string]: unknown;
}

/** Result of the guard check */
export interface GuardResult {
  allowed: boolean;
  /** Fields that were rejected (attempted null/empty overwrite) */
  rejectedFields: string[];
  /** Safe payload with protected fields stripped out */
  safePayload: VisitUpdatePayload;
}

// ---------------------------------------------------------------------------
// Guard logic (pure functions, no AWS SDK dependencies)
// ---------------------------------------------------------------------------

/**
 * Validate a Visit update payload against the existing record.
 *
 * Rules:
 * - If the existing record has a non-null, non-empty transcriptRaw,
 *   any attempt to set it to null or "" is rejected.
 * - Same rule applies to extractedJson.
 * - The returned safePayload has the rejected fields removed so the
 *   caller can safely proceed with the remaining fields.
 *
 * @param existing  Current Visit record (from DynamoDB)
 * @param update    Proposed update payload
 * @returns         GuardResult with allowed flag, rejected fields, and safe payload
 */
export function guardVisitUpdate(
  existing: VisitSourceOfTruth,
  update: VisitUpdatePayload
): GuardResult {
  const rejectedFields: string[] = [];
  const safePayload: VisitUpdatePayload = { ...update };

  const protectedFields: Array<keyof VisitSourceOfTruth> = [
    "transcriptRaw",
    "extractedJson",
  ];

  for (const field of protectedFields) {
    const existingValue = existing[field];
    const proposedValue = update[field];

    // Only enforce protection when the existing value is set (non-null, non-empty)
    const existingIsSet =
      existingValue !== null &&
      existingValue !== undefined &&
      existingValue !== "";

    if (!existingIsSet) {
      continue;
    }

    // Existing value is set — reject null/empty overwrites
    const proposedIsEmpty =
      proposedValue === null ||
      proposedValue === undefined ||
      proposedValue === "";

    if (proposedIsEmpty) {
      rejectedFields.push(field);
      delete safePayload[field];
    }
  }

  return {
    allowed: rejectedFields.length === 0,
    rejectedFields,
    safePayload,
  };
}

/**
 * Build a safe update payload that excludes protected fields
 * when they would be overwritten with null/empty values.
 *
 * @param existing  Current Visit record
 * @param update    Proposed update payload
 * @returns         Safe payload ready for DynamoDB update
 */
export function buildSafeVisitUpdate(
  existing: VisitSourceOfTruth,
  update: VisitUpdatePayload
): VisitUpdatePayload {
  const { safePayload } = guardVisitUpdate(existing, update);
  return safePayload;
}
