/**
 * fast-check カスタムジェネレータ
 * Feature: vet-voice-medical-record
 */

import * as fc from "fast-check";

/**
 * CowSex enum ジェネレータ
 */
export const cowSexArb = fc.oneof(
  fc.constant("FEMALE" as const),
  fc.constant("MALE" as const),
  fc.constant("CASTRATED" as const)
);

/**
 * Visit status ジェネレータ
 */
export const visitStatusArb = fc.oneof(
  fc.constant("IN_PROGRESS" as const),
  fc.constant("COMPLETED" as const)
);

/**
 * ExtractedJSON ジェネレータ
 */
export const extractedJsonArb = fc.record({
  vital: fc.record({
    temp_c: fc.oneof(
      fc.float({ min: 35.0, max: 42.0, noNaN: true }),
      fc.constant(null)
    ),
  }),
  s: fc.oneof(fc.string(), fc.constant(null)),
  o: fc.oneof(fc.string(), fc.constant(null)),
  a: fc.array(
    fc.record({
      name: fc.string({ minLength: 1 }),
      confidence: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
      master_code: fc.option(fc.string(), { nil: undefined }),
      status: fc.option(
        fc.oneof(
          fc.constant("confirmed" as const),
          fc.constant("unconfirmed" as const)
        ),
        { nil: undefined }
      ),
    })
  ),
  p: fc.array(
    fc.record({
      name: fc.string({ minLength: 1 }),
      type: fc.oneof(
        fc.constant("procedure" as const),
        fc.constant("drug" as const)
      ),
      dosage: fc.option(fc.string(), { nil: undefined }),
      confidence: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
      master_code: fc.option(fc.string(), { nil: undefined }),
      status: fc.option(
        fc.oneof(
          fc.constant("confirmed" as const),
          fc.constant("unconfirmed" as const)
        ),
        { nil: undefined }
      ),
    })
  ),
});

/**
 * Cow ID ジェネレータ（10桁の個体識別番号）
 */
export const cowIdArb = fc
  .integer({ min: 0, max: 9999999999 })
  .map((n) => n.toString().padStart(10, "0"));

/**
 * Visit ID ジェネレータ（ULID形式）
 */
export const visitIdArb = fc
  .tuple(fc.hexaString({ minLength: 26, maxLength: 26 }))
  .map(([hex]) => hex.toUpperCase());

/**
 * ISO datetime ジェネレータ
 */
export const isoDatetimeArb = fc.date().map((d) => d.toISOString());

/**
 * Cow モデルジェネレータ
 */
export const cowArb = fc.record({
  cowId: cowIdArb,
  earTagNo: fc.option(fc.string(), { nil: undefined }),
  sex: fc.option(cowSexArb, { nil: undefined }),
  breed: fc.option(fc.string(), { nil: undefined }),
  birthDate: fc.option(fc.date().map((d) => d.toISOString().split("T")[0]), { nil: undefined }),
  parity: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
  lastCalvingDate: fc.option(fc.date().map((d) => d.toISOString().split("T")[0]), { nil: undefined }),
  name: fc.option(fc.string(), { nil: undefined }),
  farm: fc.option(fc.string(), { nil: undefined }),
  createdAt: fc.option(isoDatetimeArb, { nil: undefined }),
});

/**
 * Visit モデルジェネレータ
 */
export const visitArb = fc.record({
  visitId: visitIdArb,
  cowId: cowIdArb,
  datetime: isoDatetimeArb,
  status: visitStatusArb,
  transcriptRaw: fc.option(fc.string(), { nil: undefined }),
  transcriptExpanded: fc.option(fc.string(), { nil: undefined }),
  extractedJson: fc.option(extractedJsonArb, { nil: undefined }),
  soapText: fc.option(fc.string(), { nil: undefined }),
  kyosaiText: fc.option(fc.string(), { nil: undefined }),
  templateType: fc.option(fc.string(), { nil: undefined }),
  updatedAt: fc.option(isoDatetimeArb, { nil: undefined }),
});

/**
 * 必須フィールドを持つ完全なVisitジェネレータ
 * (Property 11用: transcript_raw と extracted_json が必須)
 */
export const completeVisitArb = fc.record({
  visitId: visitIdArb,
  cowId: cowIdArb,
  datetime: isoDatetimeArb,
  status: visitStatusArb,
  transcriptRaw: fc.string({ minLength: 1 }),
  transcriptExpanded: fc.option(fc.string(), { nil: undefined }),
  extractedJson: extractedJsonArb,
  soapText: fc.option(fc.string(), { nil: undefined }),
  kyosaiText: fc.option(fc.string(), { nil: undefined }),
  templateType: fc.option(fc.string(), { nil: undefined }),
  updatedAt: fc.option(isoDatetimeArb, { nil: undefined }),
});
