import { describe, expect, it } from "vitest";
import {
  extractTranscriptTextFromJson,
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
});
