import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseCsvRows } from "./compare-extractor-models.utils";

interface CliOptions {
  sourceCsvPath: string;
  outputCsvPath: string;
  limit: number;
}

interface TemplateRow {
  case_id: string;
  transcript_json_path: string;
  transcript_text: string;
  gold_human_note: string;
  template_type: string;
  note: string;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const raw = await readFile(options.sourceCsvPath, "utf8");
  const rows = parseCsvRows(raw);

  if (rows.length === 0) {
    throw new Error("Source CSV has no data rows.");
  }

  const selected = rows.slice(0, options.limit);
  const templateRows = selected.map((row, index) => {
    const caseId = (row.values.case_id || String(index + 1)).trim();
    return {
      case_id: caseId,
      transcript_json_path: (row.values.transcript_json_path ?? "").trim(),
      transcript_text: (row.values.transcript_text ?? "").trim(),
      gold_human_note: (row.values.gold_human_note ?? "").trim(),
      template_type: "",
      note: [row.values.note ?? "", "soap-compare-template"].filter(Boolean).join(" | "),
    };
  });

  const outputDir = path.dirname(options.outputCsvPath);
  await writeFile(options.outputCsvPath, toCsv(templateRows), "utf8");
  console.log(`SOAP comparison input template created: ${options.outputCsvPath}`);
  console.log(`cases: ${templateRows.length}`);
  console.log("columns: case_id, transcript_json_path/transcript_text, gold_human_note, template_type, note");
  console.log(`tip: leave template_type blank to auto-select (recommended).`);
  console.log(`tip: set template_type to one of general_soap|reproduction_soap|hoof_soap|kyosai`);
  if (!outputDir) {
    console.log("output_dir: current directory");
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const positional: string[] = [];
  let limit = 40;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit") {
      limit = parseLimit(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }
    positional.push(arg);
  }

  return {
    sourceCsvPath: positional[0] ?? "tmp/model-comparison-sample.csv",
    outputCsvPath: positional[1] ?? "tmp/soap-model-comparison-sample.40.csv",
    limit,
  };
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    throw new Error("Missing value for --limit");
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: '${value}'. Must be a positive integer.`);
  }
  return parsed;
}

function toCsv(rows: TemplateRow[]): string {
  const headers: Array<keyof TemplateRow> = [
    "case_id",
    "transcript_json_path",
    "transcript_text",
    "gold_human_note",
    "template_type",
    "note",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function toCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to create SOAP comparison template: ${message}`);
  process.exitCode = 1;
});
