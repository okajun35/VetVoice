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

function escapeForTemplateLiteral(content: string): string {
  // Escape backticks and ${} template expressions
  return content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
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

    const content = fs.readFileSync(srcPath, "utf-8");
    const escaped = escapeForTemplateLiteral(content);

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
