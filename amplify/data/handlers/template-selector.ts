/**
 * Template_Selector component
 * Feature: vet-voice-medical-record
 * Task 11.2
 *
 * Pure function component for keyword-based template auto-selection
 * and required field validation.
 *
 * Requirements: 16.1, 16.2, 16.4
 * - 16.1: References template definitions (general_soap, reproduction_soap, hoof_soap, kyosai)
 * - 16.2: Auto-selects template by keyword matching against ExtractedJSON text fields
 * - 16.4: Reports missing required fields
 */

import type { ExtractedJSON } from "./parser";
import {
  type TemplateType,
  type TemplateDefinition,
  TEMPLATES,
} from "../../../src/lib/templates";

export type { TemplateType, TemplateDefinition };

/**
 * Result of template selection
 */
export interface TemplateSelectionResult {
  selectedType: TemplateType;
  confidence: number;
  missingFields: string[];
}

/**
 * Collect all text content from ExtractedJSON text fields
 */
function collectAllText(extractedJson: ExtractedJSON): string {
  const parts: string[] = [];

  if (extractedJson.s) parts.push(extractedJson.s);
  if (extractedJson.o) parts.push(extractedJson.o);

  for (const item of extractedJson.a) {
    parts.push(item.name);
  }

  for (const item of extractedJson.p) {
    parts.push(item.name);
  }

  return parts.join(" ");
}

/**
 * Auto-select template based on keywords found in ExtractedJSON text fields.
 *
 * Selection logic:
 * 1. Collect all text from s, o, a[].name, p[].name
 * 2. Check reproduction_soap keywords first
 * 3. Check hoof_soap keywords next
 * 4. If no match -> select general_soap (default)
 * 5. confidence: matched keywords / total keywords in selected template (1.0 for default)
 *
 * @param extractedJson - ExtractedJSON object to select template for
 * @returns Template selection result with type, confidence, and missing fields
 */
export function selectTemplate(extractedJson: ExtractedJSON): TemplateSelectionResult {
  const allText = collectAllText(extractedJson);

  // Check specific templates in priority order (reproduction first, then hoof)
  const specificTemplates = TEMPLATES.filter(
    (t) => t.type !== "general_soap" && t.type !== "kyosai" && t.keywords.length > 0
  );

  for (const template of specificTemplates) {
    const matchedKeywords = template.keywords.filter((kw) => allText.includes(kw));

    if (matchedKeywords.length > 0) {
      const confidence = matchedKeywords.length / template.keywords.length;
      const missingFields = validateRequiredFields(extractedJson, template);

      return {
        selectedType: template.type,
        confidence,
        missingFields,
      };
    }
  }

  // Default: general_soap
  const defaultTemplate = TEMPLATES.find((t) => t.type === "general_soap")!;
  const missingFields = validateRequiredFields(extractedJson, defaultTemplate);

  return {
    selectedType: "general_soap",
    confidence: 1.0,
    missingFields,
  };
}

/**
 * Validate required fields for a given template and return missing field paths.
 *
 * Field path notation:
 * - "vital.temp_c": extractedJson.vital.temp_c != null
 * - "s", "o": field is not null and not empty string
 * - "a[0].name": a.length > 0 && a[0].name exists
 * - "a[0].master_code": a.length > 0 && a[0].master_code exists
 * - "p[0].name": p.length > 0 && p[0].name exists
 * - "p[0].master_code": p.length > 0 && p[0].master_code exists
 *
 * @param extractedJson - ExtractedJSON object to validate
 * @param template - Template definition containing requiredFields
 * @returns Array of missing field paths
 */
export function validateRequiredFields(
  extractedJson: ExtractedJSON,
  template: TemplateDefinition
): string[] {
  const missing: string[] = [];

  for (const field of template.requiredFields) {
    if (!isFieldPresent(extractedJson, field)) {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Check whether a field path is present and non-empty in ExtractedJSON
 */
function isFieldPresent(extractedJson: ExtractedJSON, fieldPath: string): boolean {
  switch (fieldPath) {
    case "vital.temp_c":
      return extractedJson.vital.temp_c != null;

    case "s":
      return extractedJson.s != null && extractedJson.s.length > 0;

    case "o":
      return extractedJson.o != null && extractedJson.o.length > 0;

    case "a[0].name":
      return extractedJson.a.length > 0 && typeof extractedJson.a[0].name === "string";

    case "a[0].master_code":
      return (
        extractedJson.a.length > 0 &&
        extractedJson.a[0].master_code != null &&
        extractedJson.a[0].master_code !== undefined
      );

    case "p[0].name":
      return extractedJson.p.length > 0 && typeof extractedJson.p[0].name === "string";

    case "p[0].master_code":
      return (
        extractedJson.p.length > 0 &&
        extractedJson.p[0].master_code != null &&
        extractedJson.p[0].master_code !== undefined
      );

    default:
      // Unknown field path: treat as missing
      return false;
  }
}
