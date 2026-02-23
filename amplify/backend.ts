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
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
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
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
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

// runPipeline Lambda
backend.runPipelineFunction.resources.lambda.addEnvironment(
  "VISIT_TABLE_NAME",
  visitTable.tableName
);
backend.runPipelineFunction.resources.lambda.addEnvironment(
  "COW_TABLE_NAME",
  cowTable.tableName
);
backend.runPipelineFunction.resources.lambda.addEnvironment(
  "STORAGE_BUCKET_NAME",
  bucket.bucketName
);

// generateHistorySummary Lambda
backend.generateHistorySummaryFunction.resources.lambda.addEnvironment(
  "VISIT_TABLE_NAME",
  visitTable.tableName
);
