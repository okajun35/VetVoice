/**
 * dailyDigest Lambda handler
 *
 * Scans Visit records, extracts entries created on the target JST date,
 * and publishes a single email digest to SNS.
 */

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const snsClient = new SNSClient({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "us-east-1" })
);

type VisitRecord = {
  visitId?: string;
  cowId?: string;
  createdAt?: string;
  datetime?: string;
  updatedAt?: string;
  status?: string;
  templateType?: string;
  soapText?: string;
  transcriptRaw?: string;
};

type DailyDigestSummary = {
  digestDateJst: string;
  totalVisits: number;
  completedVisits: number;
  inProgressVisits: number;
  visits: VisitRecord[];
};

type DynamoScanClient = Pick<DynamoDBDocumentClient, "send">;
type SnsPublishClient = Pick<SNSClient, "send">;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function formatDateJst(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function resolveDigestDateJst(now: Date, timeZone: string): string {
  return formatDateJst(now, timeZone);
}

function isVisitOnDigestDate(
  visit: VisitRecord,
  digestDateJst: string,
  timeZone: string
): boolean {
  const candidate = visit.createdAt ?? visit.datetime ?? visit.updatedAt;
  if (!candidate) return false;

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return false;

  return formatDateJst(parsed, timeZone) === digestDateJst;
}

function summarizeVisits(
  items: VisitRecord[],
  digestDateJst: string,
  timeZone: string
): DailyDigestSummary {
  const visits = items
    .filter((item) => isVisitOnDigestDate(item, digestDateJst, timeZone))
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt ?? left.datetime ?? 0).getTime();
      const rightTime = new Date(right.createdAt ?? right.datetime ?? 0).getTime();
      return rightTime - leftTime;
    });

  return {
    digestDateJst,
    totalVisits: visits.length,
    completedVisits: visits.filter((item) => item.status === "COMPLETED").length,
    inProgressVisits: visits.filter((item) => item.status === "IN_PROGRESS").length,
    visits,
  };
}

function buildVisitPreview(visit: VisitRecord): string {
  const previewSource = visit.soapText?.trim() || visit.transcriptRaw?.trim() || "";
  if (!previewSource) return "-";

  const flattened = previewSource.replace(/\s+/g, " ").trim();
  return flattened.length > 120 ? `${flattened.slice(0, 117)}...` : flattened;
}

export function buildDigestMessage(summary: DailyDigestSummary): string {
  const lines = [
    `Date: ${summary.digestDateJst} (JST)`,
    `Total visits: ${summary.totalVisits}`,
    `Completed: ${summary.completedVisits}`,
    `In progress: ${summary.inProgressVisits}`,
    "",
    "Visits:",
  ];

  for (const visit of summary.visits) {
    const timestamp = visit.createdAt ?? visit.datetime ?? "-";
    const template = visit.templateType ?? "-";
    const status = visit.status ?? "-";
    lines.push(
      `- ${timestamp} | cowId=${visit.cowId ?? "-"} | visitId=${visit.visitId ?? "-"} | status=${status} | template=${template}`
    );
    lines.push(`  preview: ${buildVisitPreview(visit)}`);
  }

  return lines.join("\n");
}

export async function collectVisitsForDigest(
  dynamoDocClient: DynamoScanClient,
  tableName: string
): Promise<VisitRecord[]> {
  const items: VisitRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamoDocClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression:
          "visitId, cowId, createdAt, #dt, updatedAt, #status, templateType, soapText, transcriptRaw",
        ExpressionAttributeNames: {
          "#dt": "datetime",
          "#status": "status",
        },
      })
    );

    items.push(...((result.Items as VisitRecord[] | undefined) ?? []));
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items;
}

export async function sendDailyDigestCore(
  dynamoDocClient: DynamoScanClient,
  snsPublishClient: SnsPublishClient,
  options: {
    tableName: string;
    topicArn: string;
    timeZone: string;
    subjectPrefix: string;
    now?: Date;
  }
): Promise<{ published: boolean; summary: DailyDigestSummary }> {
  const digestDateJst = resolveDigestDateJst(options.now ?? new Date(), options.timeZone);
  const items = await collectVisitsForDigest(dynamoDocClient, options.tableName);
  const summary = summarizeVisits(items, digestDateJst, options.timeZone);

  if (summary.totalVisits === 0) {
    return { published: false, summary };
  }

  await snsPublishClient.send(
    new PublishCommand({
      TopicArn: options.topicArn,
      Subject: `${options.subjectPrefix} Daily digest for ${summary.digestDateJst}`,
      Message: buildDigestMessage(summary),
    })
  );

  return { published: true, summary };
}

export const handler = async () => {
  const tableName =
    process.env.AMPLIFY_DATA_RESOURCE_NAME_VISIT ??
    process.env.VISIT_TABLE_NAME ??
    "";
  if (!tableName) {
    throw new Error("VISIT_TABLE_NAME is not configured");
  }
  const topicArn = getRequiredEnv("DIGEST_SNS_TOPIC_ARN");
  const timeZone = process.env.DIGEST_TIMEZONE?.trim() || "Asia/Tokyo";
  const subjectPrefix = process.env.DIGEST_SUBJECT_PREFIX?.trim() || "[VetVoice]";

  return sendDailyDigestCore(dynamoClient, snsClient, {
    tableName,
    topicArn,
    timeZone,
    subjectPrefix,
  });
};
