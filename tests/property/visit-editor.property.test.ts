/**
 * Property-based tests for VisitEditor state update logic
 * Task 22.2: Property 10 - Unconfirmed候補の確定による状態更新
 * Requirements: 10.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractedJsonArb } from '../helpers/generators';

// ---- Type ----------------------------------------------------------------

interface ExtractedJSON {
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

// ---- Pure logic extracted from VisitEditor for property testing ----------

function confirmAItem(json: ExtractedJSON, index: number): ExtractedJSON {
  return {
    ...json,
    a: json.a.map((item, i) =>
      i === index ? { ...item, status: 'confirmed' as const } : item
    ),
  };
}

function confirmPItem(json: ExtractedJSON, index: number): ExtractedJSON {
  return {
    ...json,
    p: json.p.map((item, i) =>
      i === index ? { ...item, status: 'confirmed' as const } : item
    ),
  };
}

function updateVitalTemp(json: ExtractedJSON, value: string): ExtractedJSON {
  const num = value === '' ? null : parseFloat(value);
  return { ...json, vital: { temp_c: isNaN(num as number) ? null : num } };
}

function updateS(json: ExtractedJSON, value: string): ExtractedJSON {
  return { ...json, s: value || null };
}

// ---- Tests ---------------------------------------------------------------

describe('Feature: vet-voice-medical-record, Property 10: Unconfirmed候補の確定による状態更新', () => {

  it('Property 10a: confirmAItem sets status to confirmed for target index only', () => {
    fc.assert(
      fc.property(
        extractedJsonArb.filter((json) => json.a.length > 0),
        fc.integer({ min: 0, max: 99 }),
        (json, rawIndex) => {
          const index = rawIndex % json.a.length;
          const result = confirmAItem(json, index);

          // target item is confirmed
          expect(result.a[index].status).toBe('confirmed');

          // other a items are unchanged
          result.a.forEach((item, i) => {
            if (i !== index) {
              expect(item).toEqual(json.a[i]);
            }
          });

          // p array is completely unchanged
          expect(result.p).toEqual(json.p);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10b: confirmPItem sets status to confirmed for target index only', () => {
    fc.assert(
      fc.property(
        extractedJsonArb.filter((json) => json.p.length > 0),
        fc.integer({ min: 0, max: 99 }),
        (json, rawIndex) => {
          const index = rawIndex % json.p.length;
          const result = confirmPItem(json, index);

          // target item is confirmed
          expect(result.p[index].status).toBe('confirmed');

          // other p items are unchanged
          result.p.forEach((item, i) => {
            if (i !== index) {
              expect(item).toEqual(json.p[i]);
            }
          });

          // a array is completely unchanged
          expect(result.a).toEqual(json.a);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10c: confirmAItem is idempotent — confirming an already-confirmed item keeps it confirmed', () => {
    fc.assert(
      fc.property(
        extractedJsonArb.filter((json) => json.a.length > 0),
        fc.integer({ min: 0, max: 99 }),
        (json, rawIndex) => {
          const index = rawIndex % json.a.length;
          const once = confirmAItem(json, index);
          const twice = confirmAItem(once, index);

          expect(twice.a[index].status).toBe('confirmed');
          expect(twice.a).toEqual(once.a);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10c (p): confirmPItem is idempotent', () => {
    fc.assert(
      fc.property(
        extractedJsonArb.filter((json) => json.p.length > 0),
        fc.integer({ min: 0, max: 99 }),
        (json, rawIndex) => {
          const index = rawIndex % json.p.length;
          const once = confirmPItem(json, index);
          const twice = confirmPItem(once, index);

          expect(twice.p[index].status).toBe('confirmed');
          expect(twice.p).toEqual(once.p);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10d: updateVitalTemp preserves all other fields', () => {
    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.float({ min: 35.0, max: 42.0, noNaN: true }).map((n) => n.toFixed(1)),
        (json, tempStr) => {
          const result = updateVitalTemp(json, tempStr);

          expect(result.vital.temp_c).toBe(parseFloat(tempStr));
          expect(result.s).toEqual(json.s);
          expect(result.o).toEqual(json.o);
          expect(result.a).toEqual(json.a);
          expect(result.p).toEqual(json.p);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10e: updateS with empty string sets s to null; non-empty string sets s to that value', () => {
    fc.assert(
      fc.property(
        extractedJsonArb,
        fc.string(),
        (json, value) => {
          const result = updateS(json, value);

          if (value === '') {
            expect(result.s).toBeNull();
          } else {
            expect(result.s).toBe(value);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

});
