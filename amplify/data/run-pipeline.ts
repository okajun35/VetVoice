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
import { selectTemplate } from "./handlers/template-selector";
import { generateSOAP } from "./handlers/soap-generator";
import { generateKyosai } from "./handlers/kyosai-generator";
import type { TemplateType } from "./handlers/template-selector";

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
      ...(result.top_confirmed && { name: top.name }),
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
      return item;
    }
    const top = result.candidates[0];

    if (!top || top.confidence <= 0) {
      return item;
    }

    return {
      ...item,
      ...(result.top_confirmed && { name: top.name }),
      confidence: top.confidence,
      master_code: top.code,
      status: result.top_confirmed ? ("confirmed" as const) : ("unconfirmed" as const),
    };
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
        transcriptExpanded = expanderOutput.expanded_text;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Dictionary expansion failed: ${msg}; using raw text`);
        transcriptExpanded = workingText;
      }

      // Step 2b: Structured extraction via Bedrock
      console.log("Extractor input text length:", (transcriptExpanded ?? workingText).length);
      try {
        extractedJson = await extract(
          {
            expanded_text: transcriptExpanded ?? workingText,
            template_type: templateType ?? undefined,
            model_id_override: extractorModelId ?? undefined,
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
  // Step 2.2: Master matching (disease / procedure)
  // -------------------------------------------------------------------------
  if (extractedJson) {
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
    // Template selection (auto or manual override)
    if (templateType) {
      resolvedTemplateType = templateType as TemplateType;
    } else {
      const templateResult = selectTemplate(extractedJson);
      resolvedTemplateType = templateResult.selectedType;
      if (templateResult.missingFields.length > 0) {
        warnings.push(`Missing fields for template: ${templateResult.missingFields.join(", ")}`);
      }
    }

    // SOAP generation
    try {
      const soapOutput = await generateSOAP(
        {
          extracted_json: extractedJson,
          template_type: resolvedTemplateType,
          cow_id: cowId,
          visit_datetime: datetime,
          model_id_override: soapModelId ?? undefined,
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
          extracted_json: extractedJson,
          template_type: resolvedTemplateType,
          cow_id: cowId,
          visit_datetime: datetime,
          model_id_override: kyosaiModelId ?? undefined,
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
