import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";

/**
 * Amplify Gen 2 backend integration
 * Region: us-east-1 (N. Virginia)
 *
 * Task 1:  Basic structure
 * Task 6:  CSV asset bundling documentation
 * Task 17: IAM policies (Bedrock, Transcribe, S3) -- to be added here
 *
 * -------------------------------------------------------------------------
 * CSV Asset Bundling Strategy (Task 6)
 * -------------------------------------------------------------------------
 * Amplify Gen 2 uses esbuild to bundle Lambda TypeScript. esbuild does NOT
 * automatically include non-JS files such as CSV master data.
 *
 * Required CSV files:
 *   - assets/dictionary.csv                (Dictionary_Expander)
 *   - assets/byoumei.csv                   (Master_Matcher -- disease master)
 *   - assets/shinryo_tensu_master_flat.csv (Master_Matcher -- procedure master)
 *
 * Solution: amplify.yml copies assets/ into the Lambda zip before deploy.
 * See the backend.phases.build.commands section in amplify.yml.
 *
 * At Lambda runtime __dirname points to the function root directory.
 * The handlers use multi-path resolution via amplify/data/asset-paths.ts:
 *   1. path.join(__dirname, "assets", filename)             -- co-located copy
 *   2. path.join(__dirname, "..", "assets", filename)       -- one level up
 *   3. path.join(__dirname, "../..", "assets", filename)    -- two levels up
 *   4. path.join(__dirname, "../../..", "assets", filename) -- three levels up
 *   5. path.join(process.cwd(), "assets", filename)         -- local dev / test
 *
 * For local development (npx ampx sandbox), assets/ is already present at
 * the project root, so candidate #5 resolves correctly without any copy.
 * -------------------------------------------------------------------------
 */
export const backend = defineBackend({
  auth,
  data,
  storage,
});

// References to Lambda functions for IAM policy additions (Task 17).
// Kept here so Task 17 can attach policies without modifying resource.ts.
export const runPipelineFn =
  backend.data.resources.functions["runPipeline"];
export const generateHistorySummaryFn =
  backend.data.resources.functions["generateHistorySummary"];

// Task 17: IAM policies will be added here:
//
// import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
//
// runPipelineFn.addToRolePolicy(new PolicyStatement({
//   effect: Effect.ALLOW,
//   actions: ["bedrock:InvokeModel"],
//   resources: [
//     "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-*",
//     "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
//   ],
// }));
//
// runPipelineFn.addToRolePolicy(new PolicyStatement({
//   effect: Effect.ALLOW,
//   actions: ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"],
//   resources: ["*"],
// }));
//
// runPipelineFn.addToRolePolicy(new PolicyStatement({
//   effect: Effect.ALLOW,
//   actions: ["s3:GetObject"],
//   resources: [backend.storage.resources.bucket.bucketArn + "/audio/*"],
// }));
