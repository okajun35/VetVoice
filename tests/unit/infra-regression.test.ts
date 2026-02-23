/**
 * Infrastructure regression tests
 * Prevents hardcoded environment variables in defineFunction calls
 * and validates dynamic env var injection pattern in backend.ts.
 *
 * These tests read source files as text and verify structural invariants.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Infrastructure regression: no hardcoded env vars in defineFunction", () => {
  const resourcePath = path.join(__dirname, "../../amplify/data/resource.ts");
  const backendPath = path.join(__dirname, "../../amplify/backend.ts");

  it("resource.ts defineFunction calls must not contain environment property", () => {
    const content = fs.readFileSync(resourcePath, "utf-8");

    // Extract all defineFunction blocks
    const defineFunctionRegex = /defineFunction\(\{[\s\S]*?\}\)/g;
    const matches = content.match(defineFunctionRegex) ?? [];

    expect(matches.length).toBeGreaterThan(0);

    for (const block of matches) {
      // Must not contain hardcoded environment property
      expect(block).not.toMatch(/environment\s*:/);
    }
  });

  it("backend.ts must inject VISIT_TABLE_NAME dynamically via addEnvironment", () => {
    const content = fs.readFileSync(backendPath, "utf-8");

    expect(content).toContain("addEnvironment");
    expect(content).toContain("VISIT_TABLE_NAME");
    expect(content).toContain("visitTable.tableName");
  });

  it("backend.ts must inject STORAGE_BUCKET_NAME dynamically via addEnvironment", () => {
    const content = fs.readFileSync(backendPath, "utf-8");

    expect(content).toContain("STORAGE_BUCKET_NAME");
    expect(content).toContain("bucket.bucketName");
  });

  it("backend.ts must not contain hardcoded DynamoDB table names", () => {
    const content = fs.readFileSync(backendPath, "utf-8");

    // Should not contain patterns like "Visit-xxxxx-NONE" or "Cow-xxxxx-NONE"
    expect(content).not.toMatch(/Visit-[a-z0-9]+-NONE/);
    expect(content).not.toMatch(/Cow-[a-z0-9]+-NONE/);
  });

  it("resource.ts must not contain hardcoded DynamoDB table names", () => {
    const content = fs.readFileSync(resourcePath, "utf-8");

    expect(content).not.toMatch(/Visit-[a-z0-9]+-NONE/);
    expect(content).not.toMatch(/Cow-[a-z0-9]+-NONE/);
  });
});
