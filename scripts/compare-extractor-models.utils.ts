import path from "node:path";
import type { ExtractedJSON } from "../amplify/data/handlers/parser";
import {
  CLINICAL_DISEASE_KEYWORDS,
  NON_DISEASE_STATE_NAMES,
  PROCEDURE_ACTION_VERBS,
  PROCEDURE_UTTERANCE_CONTEXT_TERMS,
  PROCEDURE_UTTERANCE_STRONG_KEYWORDS,
  REPRO_SCREENING_KEYWORDS,
} from "./compare-extractor-models.keywords";

export interface ComparisonCsvRow {
  lineNo: number;
  values: Record<string, string>;
}

export interface ComparisonCaseInput {
  caseId: string;
  transcriptJsonPath?: string;
  transcriptText?: string;
  goldHumanNote: string;
  goldDiseases: string[];
  goldProcedures: string[];
  goldDrugs: string[];
  note?: string;
}

const REQUIRED_HEADERS = ["gold_human_note"];
const TRANSCRIPT_HEADERS = ["transcript_json_path", "transcript_text"];

export type EncounterContext =
  | "repro_screening_inferred"
  | "diagnostic_assessment"
  | "treatment_or_intervention"
  | "general_observation";

export interface ApPolicyResult {
  procedureUttered: boolean;
  pWithoutUtterance: boolean;
  aWithoutPAllowed: boolean;
}

export function parseModelListArg(
  value: string | undefined,
  defaultModelIds: string[]
): string[] {
  if (!value || value.trim().length === 0) {
    return [...defaultModelIds];
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parsed.length === 0) {
    throw new Error("Model list is empty. Pass at least one model ID.");
  }

  return [...new Set(parsed)];
}

export function parseCsvRows(rawCsv: string): ComparisonCsvRow[] {
  const rawLines = rawCsv.split(/\r?\n/u);
  const headerIndex = rawLines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });

  if (headerIndex < 0) {
    throw new Error("CSV is empty.");
  }

  const header = splitCsvLine(rawLines[headerIndex]).map((item) => item.trim());
  const headerSet = new Set(header);
  for (const required of REQUIRED_HEADERS) {
    if (!headerSet.has(required)) {
      throw new Error(`CSV header must include '${required}'.`);
    }
  }
  if (!TRANSCRIPT_HEADERS.some((name) => headerSet.has(name))) {
    throw new Error(
      "CSV header must include at least one of 'transcript_json_path' or 'transcript_text'."
    );
  }

  const rows: ComparisonCsvRow[] = [];
  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const cells = splitCsvLine(line);
    const values: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      values[header[c]] = (cells[c] ?? "").trim();
    }
    rows.push({ lineNo: i + 1, values });
  }

  return rows;
}

export function normalizeComparisonCases(
  rows: ComparisonCsvRow[],
  datasetPath: string
): ComparisonCaseInput[] {
  const datasetDir = path.dirname(datasetPath);
  const seenCaseIds = new Set<string>();

  return rows.map((row, index) => {
    const transcriptJsonPathRaw = row.values.transcript_json_path ?? "";
    const transcriptText = row.values.transcript_text ?? "";
    const goldHumanNote = row.values.gold_human_note ?? "";
    const caseId = (row.values.case_id || `case-${String(index + 1).padStart(3, "0")}`).trim();

    if (!caseId) {
      throw new Error(`Line ${row.lineNo}: case_id resolved to empty value.`);
    }
    if (seenCaseIds.has(caseId)) {
      throw new Error(`Line ${row.lineNo}: duplicated case_id '${caseId}'.`);
    }
    seenCaseIds.add(caseId);

    if (!goldHumanNote) {
      throw new Error(`Line ${row.lineNo}: gold_human_note is required.`);
    }
    if (!transcriptJsonPathRaw && !transcriptText) {
      throw new Error(
        `Line ${row.lineNo}: set transcript_json_path or transcript_text.`
      );
    }

    const transcriptJsonPath = transcriptJsonPathRaw
      ? path.isAbsolute(transcriptJsonPathRaw)
        ? transcriptJsonPathRaw
        : path.resolve(datasetDir, transcriptJsonPathRaw)
      : undefined;

    return {
      caseId,
      transcriptJsonPath,
      transcriptText: transcriptText || undefined,
      goldHumanNote,
      goldDiseases: parseLabelList(row.values.gold_diseases),
      goldProcedures: parseLabelList(row.values.gold_procedures),
      goldDrugs: parseLabelList(row.values.gold_drugs),
      note: row.values.note || undefined,
    };
  });
}

export function extractTranscriptTextFromJson(rawJson: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid transcript JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Transcript JSON must be an object.");
  }

  const payload = parsed as {
    transcript_raw?: unknown;
    results?: { transcripts?: Array<{ transcript?: unknown }> };
  };

  if (typeof payload.transcript_raw === "string" && payload.transcript_raw.trim().length > 0) {
    return payload.transcript_raw.trim();
  }

  const candidates = payload.results?.transcripts ?? [];
  for (const item of candidates) {
    if (typeof item?.transcript !== "string") continue;
    const normalized = item.transcript.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  throw new Error("Transcript JSON does not include results.transcripts[].transcript.");
}

export function evaluateApPolicy(
  transcriptExpanded: string,
  extractedJson: ExtractedJSON
): ApPolicyResult {
  const normalizedTranscript = normalizeForMatch(transcriptExpanded);
  const procedureUttered = hasProcedureUtterance(normalizedTranscript);
  const hasP = extractedJson.p.length > 0;
  const pNameMentioned = hasP
    ? extractedJson.p.some((item) => {
        const names = [item.name, item.canonical_name].filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        );
        return names.some((name) => normalizedTranscript.includes(normalizeForMatch(name)));
      })
    : false;

  const pWithoutUtterance = hasP && !procedureUttered && !pNameMentioned;
  const aWithoutPAllowed = extractedJson.a.length > 0 && !hasP && !procedureUttered;
  return { procedureUttered, pWithoutUtterance, aWithoutPAllowed };
}

export function inferEncounterContext(
  transcriptExpanded: string,
  extractedJson: ExtractedJSON
): EncounterContext {
  const normalizedTranscript = normalizeForMatch(transcriptExpanded);
  const combinedText = normalizeForMatch(
    [
      transcriptExpanded,
      extractedJson.s ?? "",
      extractedJson.o ?? "",
      ...extractedJson.a.map((item) => item.name),
      ...extractedJson.p.map((item) => item.name),
    ].join(" ")
  );

  const { procedureUttered } = evaluateApPolicy(transcriptExpanded, extractedJson);
  const hasTreatmentSignal = procedureUttered || extractedJson.p.length > 0;
  if (hasTreatmentSignal) return "treatment_or_intervention";

  const hasReproSignal =
    extractedJson.diagnostic_pattern === "reproductive" ||
    countKeywordHits(combinedText, REPRO_SCREENING_KEYWORDS) >= 2;

  const hasClinicalDiseaseA = extractedJson.a.some((item) => {
    const normalizedName = normalizeForMatch(item.name);
    return !NON_DISEASE_STATE_NAMES.has(normalizedName);
  });
  const hasClinicalDiseaseText = countKeywordHits(combinedText, CLINICAL_DISEASE_KEYWORDS) > 0;
  const hasClinicalDiseaseSignal = hasClinicalDiseaseA || hasClinicalDiseaseText;

  if (hasReproSignal && !hasClinicalDiseaseSignal) {
    return "repro_screening_inferred";
  }

  if (
    hasClinicalDiseaseSignal ||
    extractedJson.a.length > 0 ||
    (typeof extractedJson.s === "string" && extractedJson.s.trim().length > 0) ||
    (typeof extractedJson.o === "string" && extractedJson.o.trim().length > 0)
  ) {
    return "diagnostic_assessment";
  }

  if (normalizedTranscript.trim().length > 0) {
    return "diagnostic_assessment";
  }
  return "general_observation";
}

function parseLabelList(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split("|")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current);
  return out;
}

function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function hasProcedureUtterance(normalizedTranscript: string): boolean {
  if (
    countKeywordHits(normalizedTranscript, PROCEDURE_UTTERANCE_STRONG_KEYWORDS) >
    0
  ) {
    return true;
  }
  const hasContextTerm =
    countKeywordHits(normalizedTranscript, PROCEDURE_UTTERANCE_CONTEXT_TERMS) > 0;
  const hasActionVerb = countKeywordHits(normalizedTranscript, PROCEDURE_ACTION_VERBS) > 0;
  return hasContextTerm && hasActionVerb;
}

function countKeywordHits(normalizedText: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (normalizedText.includes(normalizeForMatch(keyword))) {
      hits += 1;
    }
  }
  return hits;
}
