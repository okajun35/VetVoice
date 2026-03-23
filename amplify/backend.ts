import { defineBackend } from "@aws-amplify/backend";
import { TimeZone } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as schedulerTargets from "aws-cdk-lib/aws-scheduler-targets";
import { auth } from "./auth/resource";
import {
  data,
  runPipelineFunction,
  generateHistorySummaryFunction,
  dailyDigestFunction,
} from "./data/resource";
import { storage } from "./storage/resource";

/**
 * Amplify Gen 2 backend integration
 * Region: us-east-1 (N. Virginia)
 *
 * Task 17: IAM policies (Bedrock, Transcribe, S3, DynamoDB)
 *
 * Note: runPipelineFunction and generateHistorySummaryFunction use
 * resourceGroupName: "data" to avoid circular dependency between
 * data and function stacks.
 */
export const backend = defineBackend({
  auth,
  data,
  storage,
  runPipelineFunction,
  generateHistorySummaryFunction,
  dailyDigestFunction,
});

// runPipeline Lambda: Bedrock permissions
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:InvokeModel"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/us.amazon.nova-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/global.amazon.nova-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/global.anthropic.claude-*",
    ],
  })
);

// runPipeline Lambda: Bedrock Marketplace subscription check permissions
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "aws-marketplace:ViewSubscriptions",
      "aws-marketplace:Subscribe",
    ],
    resources: ["*"],
  })
);

// runPipeline Lambda: Transcribe permissions
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "transcribe:StartTranscriptionJob",
      "transcribe:GetTranscriptionJob",
    ],
    resources: ["*"],
  })
);

// runPipeline Lambda: S3 read permissions for audio files
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:GetObject"],
    resources: [
      backend.storage.resources.bucket.bucketArn + "/audio/*",
    ],
  })
);

// runPipeline Lambda: S3 read/write permissions for transcripts
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:PutObject", "s3:GetObject"],
    resources: [
      backend.storage.resources.bucket.bucketArn + "/transcripts/*",
    ],
  })
);

// runPipeline Lambda: DynamoDB permissions
backend.runPipelineFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: [
      backend.data.resources.tables["Visit"].tableArn,
    ],
  })
);

// generateHistorySummary Lambda: Bedrock permissions
backend.generateHistorySummaryFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:InvokeModel"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/us.amazon.nova-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/global.amazon.nova-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/global.anthropic.claude-*",
    ],
  })
);

// generateHistorySummary Lambda: DynamoDB permissions
backend.generateHistorySummaryFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["dynamodb:Query"],
    resources: [
      backend.data.resources.tables["Visit"].tableArn,
      backend.data.resources.tables["Visit"].tableArn + "/index/*",
    ],
  })
);

// ---------------------------------------------------------------------------
// Dynamic environment variables — resolved at deploy time from CDK references
// Avoids hardcoding table names / bucket names that change across sandboxes
// ---------------------------------------------------------------------------
const visitTable = backend.data.resources.tables["Visit"];
const cowTable = backend.data.resources.tables["Cow"];
const bucket = backend.storage.resources.bucket;
const DEFAULT_TRANSCRIBE_VOCABULARY_NAME = "vetvoice-ja-vocab-v1";
type LambdaWithEnvironment = {
  addEnvironment: (name: string, value: string) => void;
};
const runPipelineLambda =
  backend.runPipelineFunction.resources.lambda as unknown as LambdaWithEnvironment;
const historySummaryLambda =
  backend.generateHistorySummaryFunction.resources.lambda as unknown as LambdaWithEnvironment;
const dailyDigestLambda =
  backend.dailyDigestFunction.resources.lambda as unknown as LambdaWithEnvironment;
const operationsNotificationEmail =
  process.env.DAILY_DIGEST_EMAIL?.trim() || "okazakijun54392@gmail.com";

const digestTopic = new sns.Topic(backend.data.stack, "DailyDigestTopic");
digestTopic.addSubscription(new subscriptions.EmailSubscription(operationsNotificationEmail));

new scheduler.Schedule(backend.data.stack, "DailyDigestSchedule", {
  schedule: scheduler.ScheduleExpression.cron({
    hour: "18",
    minute: "0",
    timeZone: TimeZone.ASIA_TOKYO,
  }),
  timeWindow: scheduler.TimeWindow.off(),
  target: new schedulerTargets.LambdaInvoke(backend.dailyDigestFunction.resources.lambda),
  description: "Runs the VetVoice daily digest once per day in JST.",
});

// runPipeline Lambda
runPipelineLambda.addEnvironment(
  "VISIT_TABLE_NAME",
  visitTable.tableName
);
runPipelineLambda.addEnvironment(
  "COW_TABLE_NAME",
  cowTable.tableName
);
runPipelineLambda.addEnvironment(
  "STORAGE_BUCKET_NAME",
  bucket.bucketName
);

runPipelineLambda.addEnvironment(
  "TRANSCRIBE_VOCABULARY_NAME",
  process.env.TRANSCRIBE_VOCABULARY_NAME?.trim() || DEFAULT_TRANSCRIBE_VOCABULARY_NAME
);

// generateHistorySummary Lambda
historySummaryLambda.addEnvironment(
  "VISIT_TABLE_NAME",
  visitTable.tableName
);

dailyDigestLambda.addEnvironment(
  "VISIT_TABLE_NAME",
  visitTable.tableName
);
dailyDigestLambda.addEnvironment(
  "DIGEST_SNS_TOPIC_ARN",
  digestTopic.topicArn
);
dailyDigestLambda.addEnvironment(
  "DIGEST_TIMEZONE",
  "Asia/Tokyo"
);
dailyDigestLambda.addEnvironment(
  "DIGEST_SUBJECT_PREFIX",
  "[VetVoice]"
);

backend.dailyDigestFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["dynamodb:Scan"],
    resources: [backend.data.resources.tables["Visit"].tableArn],
  })
);

backend.dailyDigestFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["sns:Publish"],
    resources: [digestTopic.topicArn],
  })
);
