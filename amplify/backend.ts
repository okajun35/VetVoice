import { defineBackend } from "@aws-amplify/backend";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";
import { data, runPipelineFunction, generateHistorySummaryFunction } from "./data/resource";
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
