/**
 * fast-check custom arbitraries
 * Feature: vet-voice-medical-record, cow-management-qr
 */

import * as fc from "fast-check";

/**
 * CowSex enum arbitrary
 */
export const cowSexArb = fc.oneof(
  fc.constant("FEMALE" as const),
  fc.constant("MALE" as const),
  fc.constant("CASTRATED" as const)
);

/**
 * Visit status arbitrary
 */
export const visitStatusArb = fc.oneof(
  fc.constant("IN_PROGRESS" as const),
  fc.constant("COMPLETED" as const)
);

/**
 * ISO datetime arbitrary
 */
export const isoDatetimeArb = fc.date().map((d) => d.toISOString());

/**
 * ExtractedJSON arbitrary
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
  diagnostic_pattern: fc.option(
    fc.constantFrom(
      "metabolic" as const,
      "infectious" as const,
      "reproductive" as const,
      "unknown" as const
    ),
    { nil: undefined }
  ),
  a: fc.array(
    fc.record({
      name: fc.string({ minLength: 1 }),
      canonical_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
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
      canonical_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
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
 * Cow ID arbitrary (10-digit numeric string, may start with 0)
 */
export const cowIdArb = fc
  .integer({ min: 0, max: 9999999999 })
  .map((n) => n.toString().padStart(10, "0"));

/**
 * CowData arbitrary for property tests
 * Feature: cow-management-qr
 */
export const cowDataArb = fc.record({
  cowId: cowIdArb,
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  breed: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  farm: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  earTagNo: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  sex: fc.option(
    fc.constantFrom("FEMALE" as const, "MALE" as const, "CASTRATED" as const),
    { nil: undefined }
  ),
  birthDate: fc.option(
    fc.date().map((d) => d.toISOString().split("T")[0]),
    { nil: undefined }
  ),
  parity: fc.option(fc.nat({ max: 20 }), { nil: undefined }),
  lastCalvingDate: fc.option(
    fc.date().map((d) => d.toISOString().split("T")[0]),
    { nil: undefined }
  ),
  createdAt: fc.option(isoDatetimeArb, { nil: undefined }),
  updatedAt: fc.option(isoDatetimeArb, { nil: undefined }),
});

/**
 * Visit ID arbitrary (ULID-like format)
 */
export const visitIdArb = fc
  .tuple(fc.hexaString({ minLength: 26, maxLength: 26 }))
  .map(([hex]) => hex.toUpperCase());

/**
 * Cow model arbitrary
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
 * Visit model arbitrary
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
 * Complete Visit arbitrary with required fields
 * (for Property 11: transcript_raw and extracted_json are required)
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

/**
 * PipelineResult arbitrary
 * Feature: pipeline-entry-form
 */
export const pipelineResultArb = fc.record({
  visitId: fc.string({ minLength: 1 }),
  cowId: fc.string({ minLength: 1 }),
  transcriptRaw: fc.option(fc.string(), { nil: null }),
  transcriptExpanded: fc.option(fc.string(), { nil: null }),
  extractedJson: fc.option(fc.jsonValue(), { nil: null }),
  soapText: fc.option(fc.string(), { nil: null }),
  kyosaiText: fc.option(fc.string(), { nil: null }),
  templateType: fc.option(fc.string(), { nil: null }),
  warnings: fc.option(
    fc.array(fc.option(fc.string(), { nil: null })),
    { nil: null }
  ),
});
