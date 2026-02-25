/**
 * Generate TypeScript modules from CSV/TXT asset files.
 *
 * Reads assets/*.csv and assets/prompts/*.txt, then writes
 * amplify/data/handlers/generated/*-data.ts modules that export
 * the raw file content as string constants.
 *
 * This ensures esbuild bundles the data into the Lambda package
 * automatically — no file-system reads needed at runtime.
 *
 * Usage:
 *   npx tsx scripts/generate-asset-modules.ts
 *   npm run generate-assets
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
const OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  "amplify",
  "data",
  "handlers",
  "generated",
);

// Header comment for generated files
const GENERATED_HEADER = `// AUTO-GENERATED — do not edit manually.
// Source: assets/ directory
// Regenerate: npm run generate-assets
`;

interface AssetSpec {
  /** Relative path inside assets/ */
  src: string;
  /** Output filename (without .ts) */
  outName: string;
  /** Exported constant name */
  exportName: string;
}

const ASSET_SPECS: AssetSpec[] = [
  {
    src: "dictionary.csv",
    outName: "dictionary-data",
    exportName: "DICTIONARY_CSV",
  },
  {
    src: "byoumei.csv",
    outName: "byoumei-data",
    exportName: "BYOUMEI_CSV",
  },
  {
    src: "shinryo_tensu_master_flat.csv",
    outName: "shinryo-tensu-data",
    exportName: "SHINRYO_TENSU_CSV",
  },
  {
    src: "shinryo_betsu_snow_regions.csv",
    outName: "snow-regions-data",
    exportName: "SNOW_REGIONS_CSV",
  },
  {
    src: "prompts/extractor.txt",
    outName: "extractor-prompt-data",
    exportName: "EXTRACTOR_PROMPT",
  },
];

// Mirrors ESLint no-irregular-whitespace targets (excluding normal spaces/newlines/tabs).
const IRREGULAR_WHITESPACE_RE =
  /[\u000B\u000C\u0085\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

function toUnicodeEscape(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return char;

  if (codePoint <= 0xffff) {
    return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  }

  return `\\u{${codePoint.toString(16)}}`;
}

function normalizeAssetContent(content: string): string {
  // UTF-8 BOM at file start is not semantically meaningful for CSV/TXT payloads.
  return content.replace(/^\uFEFF/, "");
}

function escapeForTemplateLiteral(content: string): string {
  // Escape backslashes/backticks/template interpolation and problematic whitespace chars.
  return content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(IRREGULAR_WHITESPACE_RE, toUnicodeEscape);
}

function generate(): void {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;

  for (const spec of ASSET_SPECS) {
    const srcPath = path.join(ASSETS_DIR, spec.src);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Warning: Skipping ${spec.src} — file not found`);
      continue;
    }

    const rawContent = fs.readFileSync(srcPath, "utf-8");
    const normalizedContent = normalizeAssetContent(rawContent);
    const escaped = escapeForTemplateLiteral(normalizedContent);

    const tsContent = `${GENERATED_HEADER}
export const ${spec.exportName} = \`${escaped}\`;
`;

    const outPath = path.join(OUTPUT_DIR, `${spec.outName}.ts`);
    fs.writeFileSync(outPath, tsContent, "utf-8");
    console.log(`Generated: ${spec.src} -> ${spec.outName}.ts`);
    generated++;
  }

  console.log(`\nGenerated ${generated} asset module(s) in ${OUTPUT_DIR}`);
}

generate();
