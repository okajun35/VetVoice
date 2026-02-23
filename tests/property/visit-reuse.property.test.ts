/**
 * Property-based tests for Visit reuse logic
 * Task 26.3: Property 19 - Visit再利用の変換正確性
 * Validates: Requirements 18.2, 18.4
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { reuseVisit } from '../../src/lib/visit-reuse';
import {
  extractedJsonArb,
  cowIdArb,
  visitIdArb,
  isoDatetimeArb,
} from '../helpers/generators';

/**
 * VisitSnapshot arbitrary with optional extractedJson and templateType
 */
const visitSnapshotArb = fc.record({
  visitId: visitIdArb,
  cowId: cowIdArb,
  datetime: isoDatetimeArb,
  extractedJson: fc.option(extractedJsonArb, { nil: undefined }),
  templateType: fc.option(fc.string(), { nil: null }),
});

/**
 * VisitSnapshot with guaranteed non-null extractedJson
 */
const visitSnapshotWithJsonArb = fc.record({
  visitId: visitIdArb,
  cowId: cowIdArb,
  datetime: isoDatetimeArb,
  extractedJson: extractedJsonArb,
  templateType: fc.option(fc.string(), { nil: null }),
});

describe('Feature: vet-voice-medical-record, Property 19: Visit再利用の変換正確性', () => {
  /**
   * Validates: Requirements 18.2, 18.4
   * extractedJson is a deep copy — equal in value to the original
   */
  it('reuseVisit(visit).extractedJson is a deep copy equal to the original', () => {
    fc.assert(
      fc.property(visitSnapshotWithJsonArb, (visit) => {
        const result = reuseVisit(visit);
        expect(result.extractedJson).toEqual(visit.extractedJson);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 18.2, 18.4
   * Mutating the result does not affect the original visit's extractedJson (independence)
   */
  it('mutating result.extractedJson does not affect the original visit', () => {
    fc.assert(
      fc.property(visitSnapshotWithJsonArb, (visit) => {
        const originalJson = JSON.parse(JSON.stringify(visit.extractedJson));
        const result = reuseVisit(visit);

        // Mutate the result
        (result.extractedJson as Record<string, unknown>)['__mutation__'] = true;

        // Original must be unchanged
        expect(visit.extractedJson).toEqual(originalJson);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 18.2, 18.4
   * cowId, datetime, visitId are NOT present in the ReuseResult
   */
  it('result does not contain cowId, datetime, or visitId', () => {
    fc.assert(
      fc.property(visitSnapshotArb, (visit) => {
        const result = reuseVisit(visit);
        const resultKeys = Object.keys(result as object);

        expect(resultKeys).not.toContain('cowId');
        expect(resultKeys).not.toContain('datetime');
        expect(resultKeys).not.toContain('visitId');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 18.2, 18.4
   * templateType is correctly copied (string -> string, null/undefined -> null)
   */
  it('templateType is correctly copied to the result', () => {
    fc.assert(
      fc.property(visitSnapshotArb, (visit) => {
        const result = reuseVisit(visit);
        const expected = visit.templateType ?? null;
        expect(result.templateType).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 18.2, 18.4
   * When extractedJson is null/undefined, result.extractedJson is null
   */
  it('result.extractedJson is null when visit.extractedJson is null or undefined', () => {
    const nullVisitArb = fc.record({
      visitId: visitIdArb,
      cowId: cowIdArb,
      datetime: isoDatetimeArb,
      extractedJson: fc.constant(undefined),
      templateType: fc.option(fc.string(), { nil: null }),
    });

    fc.assert(
      fc.property(nullVisitArb, (visit) => {
        const result = reuseVisit(visit);
        expect(result.extractedJson).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});
