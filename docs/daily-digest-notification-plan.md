## Daily Digest Notification Plan

### Goal

Send a single daily summary email to `okazakijun54392@gmail.com` that reports who submitted visits and how many visits were created, without sending a notification for every input.

### Chosen AWS Architecture

1. Application input continues to write `Visit` records as it does today.
2. A new Lambda function runs once per day via Amazon EventBridge Scheduler.
3. That Lambda queries or scans `Visit` records for the target day, builds a digest, and publishes it to Amazon SNS.
4. Amazon SNS delivers the digest email to `okazakijun54392@gmail.com`.

Why this shape:

- EventBridge Scheduler is the current AWS-recommended scheduling mechanism for Lambda.
- SNS email is the fastest way to get a working daily digest.
- Daily batching avoids notification noise.

### Current Constraints In The Existing App

The current `Visit` record does not persist who created the input, but for the current POC that is acceptable. The immediate goal is only to review which results were created that day.

Current relevant files:

- `amplify/data/resource.ts`
- `amplify/data/run-pipeline.ts`

What exists now:

- `Visit` stores `visitId`, `cowId`, `datetime`, `status`, model IDs, transcripts, and generated texts.
- `createdAt` is written by the pipeline and can be used as the daily filter source.

Consequence:

- phase 1 digest focuses on created results, not on user attribution

### Data Access Strategy For Phase 1

Use a table scan in the digest Lambda and filter records in code by JST date.

Why this is acceptable now:

- POC traffic is low
- no schema migration is needed
- implementation stays small

Later optimization path:

- add `createdDateJst`
- add a GSI for direct daily queries

This should be deferred until the table grows enough for scan cost or latency to matter.

### New Backend Resources

Add a new backend function:

- `amplify/notifications/daily-digest.ts` or `amplify/data/daily-digest.ts`

Responsibilities:

1. Determine the digest date in JST.
2. Scan `Visit` items and filter them in code for the target JST date.
3. Aggregate:
   - total count
   - count by `status`
   - list of `cowId`, `visitId`, `templateType`
   - optional preview from `soapText` or `transcriptRaw`
4. Publish the digest to SNS.

Recommended environment variables:

- `VISIT_TABLE_NAME`
- `DIGEST_SNS_TOPIC_ARN`
- `DIGEST_TIMEZONE=Asia/Tokyo`
- `DIGEST_SUBJECT_PREFIX=[VetVoice]`

### Scheduler Configuration

Create an EventBridge Scheduler schedule in `amplify/backend.ts`.

Recommended schedule:

- timezone: `Asia/Tokyo`
- cron: daily at `18:00`
- flexible time window: off

The AWS docs confirm Scheduler supports timezone-aware recurring schedules, so we do not need to convert JST to UTC manually.

### SNS Configuration

Create an SNS topic dedicated to operational digests, for example:

- topic name: `vetvoice-daily-digest`

Subscribe:

- `okazakijun54392@gmail.com`

Operational note:

- SNS email subscriptions require confirmation from the recipient.
- The digest will not deliver until the confirmation link is accepted.

### IAM Changes

The new daily digest Lambda needs:

- `dynamodb:Query` on the `Visit` table and the new GSI
- `sns:Publish` on the digest topic

The EventBridge Scheduler execution role needs:

- permission to invoke the daily digest Lambda

### Email Payload Recommendation

Keep the first version compact and operational.

Example:

```text
Subject: [VetVoice] Daily digest for 2026-03-23

Date: 2026-03-23 (JST)
Total visits created: 14
Completed: 11
In progress: 3

- 2026-03-23T01:15:00.000Z | cowId=0123456789 | visitId=visit-001 | status=COMPLETED | template=reproduction_soap
  preview: S: 食欲低下 O: 体温39.5...
- 2026-03-23T03:42:00.000Z | cowId=0001234567 | visitId=visit-002 | status=IN_PROGRESS | template=-
  preview: 右卵巣に...
```

### Files Expected To Change

- `amplify/data/resource.ts`
- `amplify/backend.ts`
- `package.json`
- `package-lock.json`
- `tests/integration/pipeline.integration.test.ts`

Possible new files:

- `amplify/data/daily-digest.ts`
- `tests/unit/daily-digest.test.ts`

### Implementation Sequence

1. Add the daily digest Lambda.
2. Add SNS topic and subscription in `amplify/backend.ts`.
3. Add EventBridge Scheduler in `amplify/backend.ts`.
4. Add tests for digest aggregation and publish behavior.
5. Deploy and confirm the SNS email subscription.

### Rollout Notes

Historical records already fit this design as long as they have `createdAt` or `datetime`.

### Recommended Phase 1 Scope

Build only the daily email digest first.

Do not add Slack in the same change because:

- it adds secret management for webhook URLs
- it duplicates notification channels before the digest format is validated

After the email digest is stable, Slack can be added as Phase 2 using the same aggregation Lambda.
