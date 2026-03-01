/**
 * runPipeline Lambda handler
 * Feature: vet-voice-medical-record
 * Task 15.1
 *
 * Orchestrates the AI pipeline for veterinary medical record generation.
 * Supports four entry points: PRODUCTION, TEXT_INPUT, AUDIO_FILE, JSON_INPUT.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { Schema } from "./resource";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { TranscribeClient } from "@aws-sdk/client-transcribe";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import { transcribe } from "./handlers/transcriber";
import { expand } from "./handlers/dictionary-expander";
import { extract } from "./handlers/extractor";
import { parse, stringify, type ExtractedJSON } from "./handlers/parser";
import { matchDisease, matchProcedure, matchDrug } from "./handlers/master-matcher";
import {
  applyDrugCanonicalOverrides,
  normalizePreExtractionTextByRules,
  normalizePlanTextByRules,
} from "./handlers/normalization-rules";
import { selectTemplate } from "./handlers/template-selector";
import { generateSOAP } from "./handlers/soap-generator";
import { generateKyosai } from "./handlers/kyosai-generator";
import type { TemplateType } from "./handlers/template-selector";
import {
  getModelConfig,
  type ComponentName,
} from "./handlers/model-config";

// ---------------------------------------------------------------------------
// AWS client singletons (reused across warm Lambda invocations)
// ---------------------------------------------------------------------------

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const transcribeClient = new TranscribeClient({ region: "us-east-1" });
const s3Client = new S3Client({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "us-east-1" })
);

/**
 * Always-on custom vocabulary for veterinary domain terms.
 * Can still be overridden via environment variable when needed.
 */
const DEFAULT_TRANSCRIBE_VOCABULARY_NAME = "vetvoice-ja-vocab-v1";
const CIDR_PATTERN = /(?:^|[^a-z0-9])cidr(?:[^a-z0-9]|$)/i;

function normalizeRoutingText(text: string): string {
  return text.normalize("NFKC").trim().toLowerCase();
}

function resolveModelIdForAudit(
  component: ComponentName,
  overrideModelId?: string
): string {
  try {
    return getModelConfig(component, false, overrideModelId).modelId;
  } catch {
    return overrideModelId?.trim() || "unknown";
  }
}

function addPlanItemIfMissing(
  items: ExtractedJSON["p"],
  item: ExtractedJSON["p"][number]
): boolean {
  const key = normalizeRoutingText(item.name);
  const exists = items.some(
    (current) =>
      current.type === item.type && normalizeRoutingText(current.name) === key
  );

  if (exists) {
    return false;
  }

  items.push(item);
  return true;
}

function reclassifyAssessmentItems(extractedJson: ExtractedJSON): {
  normalized: ExtractedJSON;
  movedCount: number;
} {
  const nextA: ExtractedJSON["a"] = [];
  const nextP: ExtractedJSON["p"] = [...extractedJson.p];
  let movedCount = 0;

  for (const item of extractedJson.a) {
    const name = item.name?.trim();
    if (!name) {
      nextA.push(item);
      continue;
    }

    const normalizedName = normalizeRoutingText(name);

    // Reproduction shorthand: CIDR is always a plan/procedure item.
    if (CIDR_PATTERN.test(normalizedName)) {
      addPlanItemIfMissing(nextP, { name, type: "procedure" });
      movedCount += 1;
      continue;
    }

    const diseaseResult = matchDisease(name);
    if (diseaseResult.top_confirmed) {
      nextA.push(item);
      continue;
    }

    const procedureResult = matchProcedure(name);
    const drugResult = matchDrug(name);

    if (procedureResult.top_confirmed || drugResult.top_confirmed) {
      const procedureScore = procedureResult.candidates[0]?.confidence ?? 0;
      const drugScore = drugResult.candidates[0]?.confidence ?? 0;
      const type =
        drugResult.top_confirmed && drugScore >= procedureScore
          ? ("drug" as const)
          : ("procedure" as const);

      addPlanItemIfMissing(nextP, { name, type });
      movedCount += 1;
      continue;
    }

    nextA.push(item);
  }

  if (movedCount === 0) {
    return { normalized: extractedJson, movedCount };
  }

  return {
    normalized: {
      ...extractedJson,
      a: nextA,
      p: nextP,
    },
    movedCount,
  };
}

function normalizePlanItem(
  item: ExtractedJSON["p"][number]
): ExtractedJSON["p"][number] {
  const sourceText = `${item.name}${item.dosage ?? ""}`;
  const normalized = {
    ...item,
    name: item.type === "procedure" ? normalizePlanTextByRules(item.name) : item.name,
    dosage: item.dosage ? normalizePlanTextByRules(item.dosage) : item.dosage,
  };

  return applyDrugCanonicalOverrides(normalized, sourceText);
}

function applyMasterMatching(extractedJson: ExtractedJSON): {
  enriched: ExtractedJSON;
  unconfirmedCount: number;
} {
  const enrichedA = extractedJson.a.map((item) => {
    const result = matchDisease(item.name);
    const top = result.candidates[0];

    if (!top || top.confidence <= 0) {
      return item;
    }

    return {
      ...item,
      ...(result.top_confirmed ? { canonical_name: top.name } : {}),
      confidence: top.confidence,
      master_code: top.code,
      status: result.top_confirmed ? ("confirmed" as const) : ("unconfirmed" as const),
    };
  });

  const enrichedP = extractedJson.p.map((item) => {
    const result =
      item.type === "procedure"
        ? matchProcedure(item.name)
        : item.type === "drug"
          ? matchDrug(item.name)
          : null;

    if (!result) {
      return normalizePlanItem(item);
    }
    const top = result.candidates[0];

    if (!top || top.confidence <= 0) {
      return normalizePlanItem(item);
    }

    return normalizePlanItem({
      ...item,
      ...(result.top_confirmed ? { canonical_name: top.name } : {}),
      confidence: top.confidence,
      master_code: top.code,
      status: result.top_confirmed ? ("confirmed" as const) : ("unconfirmed" as const),
    });
  });

  const unconfirmedCount =
    enrichedA.filter((item) => item.status === "unconfirmed").length +
    enrichedP.filter((item) => item.status === "unconfirmed").length;

  return {
    enriched: {
      ...extractedJson,
      a: enrichedA,
      p: enrichedP,
    },
    unconfirmedCount,
  };
}

function buildCanonicalPreferredView(extractedJson: ExtractedJSON): ExtractedJSON {
  return {
    ...extractedJson,
    a: extractedJson.a.map((item) => ({
      ...item,
      name: item.canonical_name ?? item.name,
    })),
    p: extractedJson.p.map((item) => ({
      ...item,
      name: item.canonical_name ?? item.name,
    })),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Schema["runPipeline"]["functionHandler"] = async (event) => {
  const {
    entryPoint,
    cowId,
    audioKey,
    transcriptText,
    extractedJson: extractedJsonInput,
    templateType,
    extractorModelId,
    soapModelId,
    kyosaiModelId,
  } = event.arguments;

  const visitId = crypto.randomUUID();
  const datetime = new Date().toISOString();
  const warnings: string[] = [];
  const extractorModelIdOverride =
    typeof extractorModelId === "string" ? extractorModelId : undefined;
  const soapModelIdOverride =
    typeof soapModelId === "string" ? soapModelId : undefined;
  const kyosaiModelIdOverride =
    typeof kyosaiModelId === "string" ? kyosaiModelId : undefined;
  const extractorModelIdResolved = resolveModelIdForAudit("extractor", extractorModelIdOverride);
  const soapModelIdResolved = resolveModelIdForAudit("soapGenerator", soapModelIdOverride);
  const kyosaiModelIdResolved = resolveModelIdForAudit("kyosaiGenerator", kyosaiModelIdOverride);

  let transcriptRaw: string | null = null;
  let transcriptExpanded: string | null = null;
  let extractedJson: ExtractedJSON | null = null;

  // -------------------------------------------------------------------------
  // Step 1: Transcription (PRODUCTION / AUDIO_FILE only)
  // -------------------------------------------------------------------------
  const needsTranscription = entryPoint === "PRODUCTION" || entryPoint === "AUDIO_FILE";

  if (needsTranscription) {
    if (!audioKey) {
      warnings.push(
        "audioKey is required for PRODUCTION/AUDIO_FILE; falling back to TEXT_INPUT mode"
      );
    } else {
      try {
        const bucketName = process.env.STORAGE_BUCKET_NAME ?? "";
        const vocabularyName = (
          process.env.TRANSCRIBE_VOCABULARY_NAME ??
          DEFAULT_TRANSCRIBE_VOCABULARY_NAME
        ).trim();
        const transcribeOutput = await transcribe(
          {
            audioKey,
            language: "ja-JP",
            bucketName,
            vocabularyName: vocabularyName ? vocabularyName : undefined,
          },
          transcribeClient,
          s3Client
        );
        transcriptRaw = transcribeOutput.transcript_raw;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Transcription failed: ${msg}; falling back to transcriptText`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Dictionary expansion + Extraction (skipped for JSON_INPUT)
  // -------------------------------------------------------------------------
  if (entryPoint === "JSON_INPUT") {
    // Skip transcription and expansion — validate via Parser only
    if (extractedJsonInput != null) {
      const jsonStr =
        typeof extractedJsonInput === "string"
          ? extractedJsonInput
          : stringify(extractedJsonInput as ExtractedJSON);
      const parseResult = parse(jsonStr);
      if (parseResult.success && parseResult.data) {
        extractedJson = parseResult.data;
      } else {
        warnings.push(
          `JSON_INPUT parse failed: ${(parseResult.errors ?? []).join(", ")}`
        );
      }
    } else {
      warnings.push("JSON_INPUT entry point requires extractedJson argument");
    }
  } else {
    // Determine working text:
    //   PRODUCTION/AUDIO_FILE: transcriptRaw (from Transcribe, may be null on error)
    //   TEXT_INPUT: transcriptText argument
    const workingText =
      transcriptRaw ??
      (typeof transcriptText === "string" ? transcriptText : null);

    if (!workingText) {
      warnings.push("No transcript text available; extractedJson will be empty");
    } else {
      // For TEXT_INPUT, record the raw text
      if (entryPoint === "TEXT_INPUT") {
        transcriptRaw = workingText;
      }

      // Step 2a: Dictionary expansion
      try {
        const expanderOutput = expand(workingText);
        transcriptExpanded = normalizePreExtractionTextByRules(expanderOutput.expanded_text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Dictionary expansion failed: ${msg}; using raw text`);
        transcriptExpanded = normalizePreExtractionTextByRules(workingText);
      }

      // Step 2b: Structured extraction via Bedrock
      console.log("Extractor input text length:", (transcriptExpanded ?? workingText).length);
      try {
        extractedJson = await extract(
          {
            expanded_text: transcriptExpanded ?? workingText,
            template_type: templateType ?? undefined,
            model_id_override: extractorModelIdOverride,
            strict_errors: true,
          },
          bedrockClient
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Extraction failed: ${msg}; extractedJson will be empty`);
      }

      // Step 2c: Validate extracted JSON via Parser
      if (extractedJson) {
        const parseResult = parse(stringify(extractedJson));
        if (!parseResult.success) {
          warnings.push(
            `Parser validation failed: ${(parseResult.errors ?? []).join(", ")}`
          );
          // Keep best-effort extractedJson
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 2.2: A/P routing guard + master matching
  // -------------------------------------------------------------------------
  if (extractedJson) {
    const rerouted = reclassifyAssessmentItems(extractedJson);
    extractedJson = rerouted.normalized;
    if (rerouted.movedCount > 0) {
      warnings.push(
        `Reclassified ${rerouted.movedCount} assessment item(s) into plan entries`
      );
    }

    const { enriched, unconfirmedCount } = applyMasterMatching(extractedJson);
    extractedJson = enriched;
    if (unconfirmedCount > 0) {
      warnings.push(
        `Master matching has ${unconfirmedCount} unconfirmed candidate(s); manual review recommended`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 2.5: Template selection + SOAP/Kyosai generation
  // -------------------------------------------------------------------------
  let resolvedTemplateType: TemplateType = "general_soap";
  let soapText: string | null = null;
  let kyosaiText: string | null = null;

  if (extractedJson) {
    const canonicalPreferredJson = buildCanonicalPreferredView(extractedJson);

    // Template selection (auto or manual override)
    if (templateType) {
      resolvedTemplateType = templateType as TemplateType;
    } else {
      const templateResult = selectTemplate(canonicalPreferredJson, {
        contextText: transcriptExpanded ?? transcriptRaw,
      });
      resolvedTemplateType = templateResult.selectedType;
      if (templateResult.missingFields.length > 0) {
        warnings.push(`Missing fields for template: ${templateResult.missingFields.join(", ")}`);
      }
    }

    // SOAP generation
    try {
      const soapOutput = await generateSOAP(
        {
          extracted_json: canonicalPreferredJson,
          template_type: resolvedTemplateType,
          cow_id: cowId,
          visit_datetime: datetime,
          model_id_override: soapModelIdOverride,
        },
        bedrockClient
      );
      soapText = soapOutput.soap_text;
      if (soapOutput.has_unconfirmed) {
        warnings.push("SOAP contains unconfirmed candidates; manual review recommended");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`SOAP generation failed: ${msg}`);
    }

    // Kyosai generation
    try {
      const kyosaiOutput = await generateKyosai(
        {
          extracted_json: canonicalPreferredJson,
          template_type: resolvedTemplateType,
          cow_id: cowId,
          visit_datetime: datetime,
          model_id_override: kyosaiModelIdOverride,
        },
        bedrockClient
      );
      kyosaiText = kyosaiOutput.kyosai_text;
      if (kyosaiOutput.has_unconfirmed) {
        warnings.push("Kyosai contains unconfirmed candidates; manual confirmation required");
      }
      if (kyosaiOutput.missing_fields.length > 0) {
        warnings.push(`Kyosai missing fields: ${kyosaiOutput.missing_fields.join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Kyosai generation failed: ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Persist Visit record to DynamoDB
  // "Save if possible" policy — pipeline result is always returned
  // -------------------------------------------------------------------------
  const tableName =
    process.env.AMPLIFY_DATA_RESOURCE_NAME_VISIT ??
    process.env.VISIT_TABLE_NAME ??
    "";

  if (tableName) {
    try {
      await dynamoClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            visitId,
            cowId,
            datetime,
            status: "COMPLETED",
            ...(transcriptRaw != null && { transcriptRaw }),
            ...(transcriptExpanded != null && { transcriptExpanded }),
            ...(extractedJson != null && { extractedJson: stringify(extractedJson) }),
            extractorModelId: extractorModelIdResolved,
            soapModelId: soapModelIdResolved,
            kyosaiModelId: kyosaiModelIdResolved,
            ...(soapText != null && { soapText }),
            ...(kyosaiText != null && { kyosaiText }),
            templateType: resolvedTemplateType,
          },
          // Prevent overwriting an existing record (data integrity guard)
          ConditionExpression: "attribute_not_exists(visitId)",
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`DynamoDB save failed: ${msg}`);
    }
  } else {
    warnings.push("VISIT_TABLE_NAME not configured; skipping DynamoDB save");
  }

  // -------------------------------------------------------------------------
  // Step 4: Return PipelineOutput
  // -------------------------------------------------------------------------
  return {
    visitId,
    cowId,
    transcriptRaw: transcriptRaw ?? null,
    transcriptExpanded: transcriptExpanded ?? null,
    extractedJson: extractedJson ?? null,
    soapText: soapText ?? null,
    kyosaiText: kyosaiText ?? null,
    templateType: resolvedTemplateType,
    warnings,
  };
};
