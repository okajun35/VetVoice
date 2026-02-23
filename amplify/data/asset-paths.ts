/**
 * Asset path resolution utility
 * Feature: vet-voice-medical-record
 * Task 6: CSV asset bundling for Lambda
 *
 * Resolves CSV asset paths across environments:
 *   - Lambda runtime (Amplify Gen 2 esbuild bundle)
 *   - Local test (Vitest, process.cwd() = project root)
 *   - Amplify sandbox
 *
 * Amplify Gen 2 bundles Lambda with esbuild. Non-JS files (CSV) are NOT
 * bundled automatically. The amplify.yml build phase copies assets/ into
 * the Lambda deployment package so they are co-located with the handler.
 *
 * At Lambda runtime __dirname resolves to the directory containing the
 * bundled handler JS. The copy step places assets/ at the same level, so
 * the first candidate below will resolve correctly.
 */

import * as path from "path";
import * as fs from "fs";

/**
 * Returns ordered candidate paths for a given asset filename.
 * Evaluated in order; the first existing path wins.
 */
function candidatePaths(filename: string): string[] {
  return [
    // Lambda: assets/ co-located with bundled handler (copied by amplify.yml)
    path.join(__dirname, "assets", filename),
    // Lambda: assets/ one level up from handler directory
    path.join(__dirname, "..", "assets", filename),
    // Lambda: assets/ two levels up (Amplify Gen 2 bundle structure variant)
    path.join(__dirname, "../..", "assets", filename),
    // Lambda: assets/ three levels up (deep bundle nesting)
    path.join(__dirname, "../../..", "assets", filename),
    // Local dev / Vitest: from project root (process.cwd())
    path.join(process.cwd(), "assets", filename),
  ];
}

/**
 * Resolve the filesystem path for a named CSV asset.
 *
 * Searches candidate directories in order and returns the first path that
 * exists. If no candidate exists, returns the project-root fallback and
 * emits a console warning so the caller fails with a clear error message.
 *
 * @param filename - Bare filename, e.g. "byoumei.csv"
 * @returns Absolute path to the asset file
 */
export function resolveAssetPath(filename: string): string {
  const candidates = candidatePaths(filename);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: project root (will throw at readFileSync with a clear message)
  const fallback = path.join(process.cwd(), "assets", filename);
  console.warn(
    `[asset-paths] Asset not found: ${filename}. Tried:\n` +
      candidates.map((c) => `  ${c}`).join("\n")
  );
  return fallback;
}
