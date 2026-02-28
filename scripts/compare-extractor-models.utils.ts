import path from "node:path";

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
  const lines = rawCsv.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = splitCsvLine(lines[0]).map((item) => item.trim());
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
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;
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
