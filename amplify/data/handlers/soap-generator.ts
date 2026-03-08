/**
 * SOAP_Generator component
 * Feature: vet-voice-medical-record
 * Task 12.1
 *
 * Generates SOAP-format veterinary medical record text from ExtractedJSON
 * using Amazon Bedrock Converse API.
 *
 * LLM: Amazon Nova Lite (default via model-config)
 * Dependencies: BedrockRuntimeClient (injected)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 15.2, 16.3
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { type ExtractedJSON } from "./parser";
import { type TemplateType, getTemplate } from "../../../src/lib/templates";
import { getModelConfig } from "./model-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SOAPInput {
  extracted_json: ExtractedJSON;
  template_type: TemplateType;
  cow_id?: string;
  visit_datetime?: string;
  model_id_override?: string; // Optional runtime model override (dev/testing)
}

export interface SOAPOutput {
  soap_text: string;
  has_unconfirmed: boolean;
}

type SoapSectionKey = "S" | "O" | "A" | "P";

type SoapSections = Record<SoapSectionKey, string>;

interface SoapValidationResult {
  normalizedText: string;
  sections: SoapSections | null;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOAP_SYSTEM_INSTRUCTION = `あなたは日本の大動物診療向けSOAP記録作成アシスタントです。
出力は必ずSOAP本文のみ（S/O/A/P）にしてください。
前置き・注釈・説明文・区切り線・Markdown見出しは出力しないでください。
構造化データに存在しない診断・検査・処置・投薬・フォローアップを追加しないでください。
用語・略語・単位は構造化データをそのまま使い、推測で変換しないでください。`;

const HARD_RULES_BLOCK = `厳守ルール:
1. 出力はS/O/A/Pの本文のみ。前置き・注釈・説明文・区切り線は書かない。
2. 構造化データにない検査/処置/投薬/提案を追加しない。
3. p[]が空の場合、Pは「処置なし」と書く。
4. 診断は断定しない。a[].statusがconfirmed以外または不明なら「疑い」または「未確認」を使う。
5. 用語・略語・単位は構造化データの表記を維持し、勝手に変換しない。`;

/** Default SOAP prompt when no template-specific prompt is available */
const DEFAULT_SOAP_PROMPT = `以下の診療の構造化データからSOAP形式の診療記録を日本語で生成してください。
Unconfirmedの候補には「（未確認）」と明示してください。

構造化データ:
{{extracted_json}}

SOAP形式で出力してください:
S（稟告）:
O（所見）:
A（評価・診断）:
P（計画・処置）:`;

const META_LINE_PATTERNS: RegExp[] = [
  /^SOAP形式の診療記録(?:は|を)?以下の通り/u,
  /^SOAP形式の診療記録を以下に/u,
  /^この診療記録は/u,
  /^以下に作成しました/u,
  /^Unconfirmedの候補には/u,
  /^構造化データに基づいて/u,
  /^(?:---|___|\*\*\*|#\s)/u,
];

const DEFINITIVE_DIAGNOSIS_PATTERN =
  /(?:確定|断定|診断されています|と診断|診断した|diagnosed|definitive)/iu;
const SOFT_DIAGNOSIS_PATTERN = /(?:疑い|未確認|可能性|示唆|suspected|rule\s*out)/iu;
const PLAN_ACTION_PATTERN =
  /(?:投与|処方|実施|施行|提案|検査|超音波|ホルモン|再診|フォロー|観察|手術)/u;
const PLAN_NONE_PATTERN = /(?:^|\n)\s*(?:処置なし|なし|特記事項なし|データなし)\s*(?:$|\n)/u;
const UNIT_TOKEN_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|ml|mL|mm)\b/u;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether any a[] or p[] item has status === "unconfirmed".
 */
function checkHasUnconfirmed(extractedJson: ExtractedJSON): boolean {
  const aHas = extractedJson.a.some((item) => item.status === "unconfirmed");
  const pHas = extractedJson.p.some((item) => item.status === "unconfirmed");
  return aHas || pHas;
}

/**
 * Build the prompt string by substituting placeholders.
 */
function buildPrompt(
  template: string,
  extractedJson: ExtractedJSON,
  cowId?: string,
  visitDatetime?: string,
): string {
  let prompt = `${HARD_RULES_BLOCK}\n\n${template}`;
  prompt = prompt.replace(
    "{{extracted_json}}",
    JSON.stringify(extractedJson, null, 2),
  );
  if (cowId !== undefined) {
    prompt = prompt.replace("{{cow_id}}", cowId);
  }
  if (visitDatetime !== undefined) {
    prompt = prompt.replace("{{visit_datetime}}", visitDatetime);
  }
  return prompt;
}

function removeMetaLines(rawText: string): string {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      kept.push("");
      continue;
    }

    if (META_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n").trim();
}

function parseHeadingLine(line: string): { section: SoapSectionKey; inlineText: string } | null {
  const normalized = line
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .trim();

  const matched = normalized.match(/^([SOAP])\s*（[^）]+）\s*[:：]\s*(.*)$/u);
  if (!matched) return null;

  return {
    section: matched[1] as SoapSectionKey,
    inlineText: matched[2].trim(),
  };
}

function parseSoapSections(text: string): SoapSections | null {
  const sections: Record<SoapSectionKey, string[]> = {
    S: [],
    O: [],
    A: [],
    P: [],
  };

  let current: SoapSectionKey | null = null;
  for (const line of text.split("\n")) {
    const heading = parseHeadingLine(line);
    if (heading) {
      current = heading.section;
      if (heading.inlineText.length > 0) {
        sections[current].push(heading.inlineText);
      }
      continue;
    }

    if (!current) {
      continue;
    }

    const cleanedLine = line
      .trim()
      .replace(/^[-*]\s+/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();

    if (cleanedLine.length === 0) continue;
    if (/^---+$/.test(cleanedLine)) continue;

    sections[current].push(cleanedLine);
  }

  const hasAnySectionContent =
    sections.S.length > 0 ||
    sections.O.length > 0 ||
    sections.A.length > 0 ||
    sections.P.length > 0;

  if (!hasAnySectionContent) {
    return null;
  }

  return {
    S: sections.S.join("\n").trim(),
    O: sections.O.join("\n").trim(),
    A: sections.A.join("\n").trim(),
    P: sections.P.join("\n").trim(),
  };
}

function formatSoapSections(sections: SoapSections): string {
  return [
    `S（稟告）: ${sections.S || "特記事項なし"}`,
    `O（所見）: ${sections.O || "特記事項なし"}`,
    `A（評価・診断）: ${sections.A || "評価なし"}`,
    `P（計画・処置）: ${sections.P || "処置なし"}`,
  ].join("\n");
}

function formatAssessmentItem(name: string, status?: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  if (status === "confirmed") {
    return trimmed;
  }

  if (/疑い|未確認/u.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}（未確認）`;
}

function formatPlanItem(name: string, dosage?: string): string {
  const trimmedName = name.trim();
  const trimmedDosage = dosage?.trim();
  if (!trimmedName) return "";
  if (trimmedDosage && trimmedDosage.length > 0) {
    return `${trimmedName} ${trimmedDosage}`;
  }
  return trimmedName;
}

function buildDeterministicSoap(extractedJson: ExtractedJSON): string {
  const sText = extractedJson.s?.trim() || "特記事項なし";
  const oText = extractedJson.o?.trim() || "特記事項なし";

  const assessment = extractedJson.a
    .map((item) => formatAssessmentItem(item.name, item.status))
    .filter((item) => item.length > 0)
    .join("、");

  const plan = extractedJson.p
    .map((item) => formatPlanItem(item.name, item.dosage))
    .filter((item) => item.length > 0)
    .join("、");

  const sections: SoapSections = {
    S: sText,
    O: oText,
    A: assessment || "評価なし",
    P: plan || "処置なし",
  };

  return formatSoapSections(sections);
}

function validateSoapOutput(
  sections: SoapSections | null,
  normalizedText: string,
  input: SOAPInput,
  hasUnconfirmed: boolean,
): string[] {
  const violations = new Set<string>();

  if (META_LINE_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    violations.add("PROMPT_LEAK");
  }

  if (!sections) {
    violations.add("INVALID_STRUCTURE");
    return [...violations];
  }

  if (hasUnconfirmed && !/(未確認|疑い)/u.test(normalizedText)) {
    violations.add("MISSING_UNCONFIRMED_MARKER");
  }

  const hasUncertainAssessment = input.extracted_json.a.some(
    (item) => item.status !== "confirmed",
  );
  if (
    hasUncertainAssessment &&
    DEFINITIVE_DIAGNOSIS_PATTERN.test(sections.A) &&
    !SOFT_DIAGNOSIS_PATTERN.test(sections.A)
  ) {
    violations.add("DX_ASSERTION");
  }

  const extractedPlanItems = input.extracted_json.p;
  if (extractedPlanItems.length === 0) {
    const normalizedPlanSection = sections.P.trim().length > 0 ? sections.P : "処置なし";
    if (!PLAN_NONE_PATTERN.test(normalizedPlanSection)) {
      violations.add("PLAN_HALLUCINATION");
    }
    if (
      PLAN_ACTION_PATTERN.test(normalizedPlanSection) &&
      !PLAN_NONE_PATTERN.test(normalizedPlanSection)
    ) {
      violations.add("PLAN_HALLUCINATION");
    }
  } else {
    for (const item of extractedPlanItems) {
      if (!sections.P.includes(item.name)) {
        violations.add("PLAN_HALLUCINATION");
      }
      if (item.dosage && !sections.P.includes(item.dosage)) {
        violations.add("FACTUAL_ISSUE");
      }
    }

    const hasAnyKnownPlanTerm = extractedPlanItems.some((item) =>
      sections.P.includes(item.name),
    );
    if (!hasAnyKnownPlanTerm) {
      violations.add("PLAN_HALLUCINATION");
    }

    if (
      extractedPlanItems.every((item) => !item.dosage) &&
      UNIT_TOKEN_PATTERN.test(sections.P)
    ) {
      const knownUnitInInput = extractedPlanItems.some((item) =>
        UNIT_TOKEN_PATTERN.test(item.name),
      );
      if (!knownUnitInInput) {
        violations.add("FACTUAL_ISSUE");
      }
    }
  }

  const fullSoap = `${sections.O}\n${sections.A}\n${sections.P}`;
  if (/CIDR/iu.test(fullSoap) && /子宮内|intrauterine/iu.test(fullSoap)) {
    violations.add("TERMINOLOGY_ERROR");
  }

  return [...violations];
}

function validateAndNormalizeSoap(
  rawText: string,
  input: SOAPInput,
  hasUnconfirmed: boolean,
): SoapValidationResult {
  const cleaned = removeMetaLines(rawText);
  const sections = parseSoapSections(cleaned);
  const normalizedText = sections ? formatSoapSections(sections) : cleaned;
  const violations = validateSoapOutput(
    sections,
    normalizedText,
    input,
    hasUnconfirmed,
  );

  return {
    normalizedText,
    sections,
    violations,
  };
}

async function requestSoapText(
  bedrockClient: BedrockRuntimeClient,
  modelId: string,
  temperature: number,
  maxTokens: number,
  prompt: string,
  retryViolations?: string[],
): Promise<string> {
  const repairInstruction = retryViolations?.length
    ? `\n\n前回出力の違反:\n- ${retryViolations.join("\n- ")}\n\n違反を修正し、SOAP本文のみを再出力してください。`
    : "";

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId,
      system: [{ text: SOAP_SYSTEM_INSTRUCTION }],
      messages: [
        {
          role: "user",
          content: [{ text: `${prompt}${repairInstruction}` }],
        },
      ],
      inferenceConfig: {
        maxTokens,
        temperature,
      },
    }),
  );

  return response.output?.message?.content?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a SOAP-format medical record text from ExtractedJSON using Bedrock.
 *
 * @param input         SOAPInput (extracted_json, template_type, optional cow_id/visit_datetime)
 * @param bedrockClient Injected BedrockRuntimeClient
 * @returns             SOAPOutput with soap_text and has_unconfirmed flag
 */
export async function generateSOAP(
  input: SOAPInput,
  bedrockClient: BedrockRuntimeClient,
): Promise<SOAPOutput> {
  const has_unconfirmed = checkHasUnconfirmed(input.extracted_json);

  // Resolve template: try requested type, fall back to general_soap
  const template =
    getTemplate(input.template_type) ?? getTemplate("general_soap");

  // Pick prompt: template-specific or default
  const promptTemplate =
    template?.soapPromptTemplate ?? DEFAULT_SOAP_PROMPT;

  const prompt = buildPrompt(
    promptTemplate,
    input.extracted_json,
    input.cow_id,
    input.visit_datetime,
  );

  const config = getModelConfig("soapGenerator", false, input.model_id_override);

  const firstRaw = await requestSoapText(
    bedrockClient,
    config.modelId,
    config.temperature,
    config.maxTokens,
    prompt,
  );

  const firstResult = validateAndNormalizeSoap(firstRaw, input, has_unconfirmed);
  if (firstResult.violations.length === 0 && firstResult.sections) {
    return { soap_text: firstResult.normalizedText, has_unconfirmed };
  }

  const secondRaw = await requestSoapText(
    bedrockClient,
    config.modelId,
    config.temperature,
    config.maxTokens,
    prompt,
    firstResult.violations,
  );

  const secondResult = validateAndNormalizeSoap(secondRaw, input, has_unconfirmed);
  if (secondResult.violations.length === 0 && secondResult.sections) {
    return { soap_text: secondResult.normalizedText, has_unconfirmed };
  }

  // Last-resort safety fallback.
  return {
    soap_text: buildDeterministicSoap(input.extracted_json),
    has_unconfirmed,
  };
}
