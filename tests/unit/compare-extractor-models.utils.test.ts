import { describe, expect, it } from "vitest";
import {
  evaluateApPolicy,
  extractTranscriptTextFromJson,
  inferEncounterContext,
  normalizeComparisonCases,
  parseCsvRows,
  parseModelListArg,
} from "../../scripts/compare-extractor-models.utils";

describe("compare-extractor-models utils", () => {
  it("parses model list and deduplicates IDs", () => {
    const modelIds = parseModelListArg(
      " anthropic.claude-haiku-4-5-20251001-v1:0 , amazon.nova-pro-v1:0,amazon.nova-pro-v1:0 ",
      ["default-model"]
    );

    expect(modelIds).toEqual([
      "anthropic.claude-haiku-4-5-20251001-v1:0",
      "amazon.nova-pro-v1:0",
    ]);
  });

  it("parses CSV rows and keeps quoted comma values", () => {
    const rows = parseCsvRows(
      [
        "case_id,transcript_json_path,gold_human_note,note",
        '1,tmp/input.json,"藤井さん,牛1234,処置はCIDR","comma note"',
      ].join("\n")
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].values.gold_human_note).toBe("藤井さん,牛1234,処置はCIDR");
  });

  it("preserves original line numbers when CSV contains blank lines", () => {
    const rows = parseCsvRows(
      [
        "case_id,transcript_json_path,gold_human_note,note",
        "",
        '1,tmp/input-1.json,"1件目"',
        "",
        '2,tmp/input-2.json,"2件目"',
      ].join("\n")
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].lineNo).toBe(3);
    expect(rows[1].lineNo).toBe(5);
  });

  it("normalizes case rows with auto case_id and resolved path", () => {
    const rows = parseCsvRows(
      [
        "transcript_json_path,gold_human_note,gold_diseases,gold_procedures,gold_drugs",
        "s3.json,人手メモ,肺炎|子宮内膜炎,CIDR,アモキシシリン",
      ].join("\n")
    );

    const cases = normalizeComparisonCases(rows, "/home/hddwm390/VetVoice/tmp/cases.csv");
    expect(cases).toHaveLength(1);
    expect(cases[0].caseId).toBe("case-001");
    expect(cases[0].transcriptJsonPath).toBe("/home/hddwm390/VetVoice/tmp/s3.json");
    expect(cases[0].goldDiseases).toEqual(["肺炎", "子宮内膜炎"]);
    expect(cases[0].goldProcedures).toEqual(["CIDR"]);
    expect(cases[0].goldDrugs).toEqual(["アモキシシリン"]);
  });

  it("extracts transcript text from transcribe output JSON", () => {
    const transcript = extractTranscriptTextFromJson(
      JSON.stringify({
        results: {
          transcripts: [{ transcript: "藤井さんウ1234 右なし左CL5 処置CIDR" }],
        },
      })
    );

    expect(transcript).toBe("藤井さんウ1234 右なし左CL5 処置CIDR");
  });

  it("throws when transcript text is missing in JSON", () => {
    expect(() =>
      extractTranscriptTextFromJson(
        JSON.stringify({
          results: {
            transcripts: [],
          },
        })
      )
    ).toThrow("Transcript JSON does not include results.transcripts[].transcript.");
  });

  it("infers repro_screening_inferred when reproduction context exists with no treatment signal", () => {
    const context = inferEncounterContext(
      "妊娠中で外子宮口見えず、膣内異常なし",
      {
        vital: { temp_c: null },
        s: null,
        o: "妊娠中、外子宮口見えず、膣内異常なし",
        diagnostic_pattern: "reproductive",
        a: [{ name: "妊娠" }],
        p: [],
      }
    );

    expect(context).toBe("repro_screening_inferred");
  });

  it("flags p_without_utterance when p is populated without procedure signal", () => {
    const policy = evaluateApPolicy(
      "食欲不振、ケトン臭あり",
      {
        vital: { temp_c: null },
        s: "食欲不振",
        o: "ケトン臭あり",
        diagnostic_pattern: "metabolic",
        a: [{ name: "ケトーシス" }],
        p: [{ name: "CIDR", type: "procedure" }],
      }
    );

    expect(policy.procedureUttered).toBe(false);
    expect(policy.pWithoutUtterance).toBe(true);
    expect(policy.aWithoutPAllowed).toBe(false);
  });

  it("treats a-present/p-empty as allowed when no procedure utterance exists", () => {
    const policy = evaluateApPolicy(
      "食欲不振、ケトン臭あり",
      {
        vital: { temp_c: null },
        s: "食欲不振",
        o: "ケトン臭あり",
        diagnostic_pattern: "metabolic",
        a: [{ name: "ケトーシス" }],
        p: [],
      }
    );

    expect(policy.procedureUttered).toBe(false);
    expect(policy.pWithoutUtterance).toBe(false);
    expect(policy.aWithoutPAllowed).toBe(true);
  });

  it("does not treat CIDR mention alone as procedure utterance", () => {
    const policy = evaluateApPolicy(
      "右なし左CL5、CIDR候補",
      {
        vital: { temp_c: null },
        s: null,
        o: "右なし左CL5",
        diagnostic_pattern: "reproductive",
        a: [{ name: "妊娠" }],
        p: [],
      }
    );

    expect(policy.procedureUttered).toBe(false);
  });

  it("treats CIDR with action verb as procedure utterance", () => {
    const policy = evaluateApPolicy(
      "右なし左CL5、CIDR挿入予定",
      {
        vital: { temp_c: null },
        s: null,
        o: "右なし左CL5",
        diagnostic_pattern: "reproductive",
        a: [{ name: "妊娠" }],
        p: [],
      }
    );

    expect(policy.procedureUttered).toBe(true);
  });
});
