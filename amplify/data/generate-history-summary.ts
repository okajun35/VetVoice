/**
 * generateHistorySummary Lambda handler
 * Feature: vet-voice-medical-record
 * Task 16.1
 *
 * Generates a summary of the most recent 3 visits for a given cow.
 * Uses DynamoDB GSI (cowId-datetime-index) and Bedrock (Nova Micro).
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */

import type { Schema } from "./resource";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getModelConfig } from "./handlers/model-config";

// ---------------------------------------------------------------------------
// AWS client singletons (reused across warm Lambda invocations)
// ---------------------------------------------------------------------------

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "us-east-1" })
);

// ---------------------------------------------------------------------------
// Core logic (exported for testability via dependency injection)
// ---------------------------------------------------------------------------

/**
 * Core implementation of generateHistorySummary.
 * Accepts injected clients so tests can mock them.
 */
export async function generateHistorySummaryCore(
  cowId: string,
  dynamoDocClient: DynamoDBDocumentClient,
  bedrockRuntimeClient: BedrockRuntimeClient,
  tableName: string
): Promise<string> {
  // Step 1: Query DynamoDB for the most recent 3 visits via GSI
  const queryResult = await dynamoDocClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "cowId-datetime-index",
      KeyConditionExpression: "cowId = :cowId",
      ExpressionAttributeValues: {
        ":cowId": cowId,
      },
      ScanIndexForward: false, // descending by datetime
      Limit: 3,
    })
  );

  const items = queryResult.Items ?? [];

  // Step 2: Return early if no visits found
  if (items.length === 0) {
    return "診療履歴がありません";
  }

  // Step 3: Build summary prompt from visits' extractedJson fields
  const visitSummaries = items.map((item, index) => {
    const datetime = item.datetime ?? "不明";
    const extractedJsonRaw = item.extractedJson;

    let clinicalData = "";
    if (extractedJsonRaw) {
      try {
        const json =
          typeof extractedJsonRaw === "string"
            ? JSON.parse(extractedJsonRaw)
            : extractedJsonRaw;

        const parts: string[] = [];
        if (json.vital?.temp_c != null) {
          parts.push(`体温: ${json.vital.temp_c}℃`);
        }
        if (json.s) parts.push(`稟告: ${json.s}`);
        if (json.o) parts.push(`所見: ${json.o}`);
        if (Array.isArray(json.a) && json.a.length > 0) {
          parts.push(
            `診断: ${json.a
              .map((a: { name: string; canonical_name?: string }) => a.canonical_name ?? a.name)
              .join(", ")}`
          );
        }
        if (Array.isArray(json.p) && json.p.length > 0) {
          parts.push(
            `処置・薬剤: ${json.p
              .map((p: { name: string; canonical_name?: string }) => p.canonical_name ?? p.name)
              .join(", ")}`
          );
        }
        clinicalData = parts.join(" / ");
      } catch {
        clinicalData = "（データ解析不可）";
      }
    } else {
      clinicalData = "（データなし）";
    }

    return `診療${index + 1} (${datetime}): ${clinicalData}`;
  });

  const prompt = `以下は牛（ID: ${cowId}）の直近${items.length}件の診療記録です。主要な臨床イベント、診断名、処置・薬剤を簡潔にまとめてください。

${visitSummaries.join("\n")}

上記の診療履歴を獣医師向けに簡潔な日本語でサマリーしてください。`;

  // Step 4: Call Bedrock with historySummary model config
  const modelConfig = getModelConfig("historySummary");

  const response = await bedrockRuntimeClient.send(
    new ConverseCommand({
      modelId: modelConfig.modelId,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
      },
    })
  );

  const summaryText = response.output?.message?.content?.[0]?.text ?? "";
  return summaryText;
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const handler: Schema["generateHistorySummary"]["functionHandler"] = async (
  event
) => {
  const { cowId } = event.arguments;

  const tableName =
    process.env.AMPLIFY_DATA_RESOURCE_NAME_VISIT ??
    process.env.VISIT_TABLE_NAME ??
    "";

  return generateHistorySummaryCore(cowId, dynamoClient, bedrockClient, tableName);
};
