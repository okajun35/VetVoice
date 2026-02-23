# Amplify Gen 2 コードパターン

## Lambda関数定義パターン

### defineFunction + カスタムクエリ

```typescript
// amplify/data/resource.ts
import {
  type ClientSchema,
  a,
  defineData,
  defineFunction,
} from "@aws-amplify/backend";

// 環境変数付きLambda関数定義
export const MODEL_ID = "amazon.nova-pro-v1:0";

const myFunction = defineFunction({
  name: "myFunction",
  entry: "./my-handler.ts",
  timeoutSeconds: 120,
  memoryMB: 512,
  environment: {
    MODEL_ID,  // 環境変数として渡す
  },
});

// カスタムクエリにLambda関数をバインド
const schema = a.schema({
  MyOutput: a.customType({
    result: a.string(),
  }),
  myQuery: a
    .query()
    .arguments({ input: a.string().required() })
    .returns(a.ref("MyOutput"))
    .handler(a.handler.function(myFunction))
    .authorization((allow) => [allow.authenticated()]),
});
```

### Lambda Handler の型安全な実装

```typescript
// amplify/data/my-handler.ts
import type { Schema } from "./resource";

// Schema型からfunctionHandlerを取得 → 引数・戻り値が型安全
export const handler: Schema["myQuery"]["functionHandler"] = async (
  event,
  context
) => {
  const { input } = event.arguments;
  return { result: `Processed: ${input}` };
};
```

### 環境変数の参照

```typescript
// Lambda handler内で環境変数を参照
import { env } from "$amplify/env/myFunction";

const modelId = env.MODEL_ID;
```

## backend.ts IAMポリシーパターン

### Bedrock / Transcribe / S3 権限付与

```typescript
// amplify/backend.ts
import { defineBackend } from "@aws-amplify/backend";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

const backend = defineBackend({ auth, data, storage });

// Lambda関数への参照取得
const lambdaFn = backend.data.resources.functions["functionName"];

// Bedrock InvokeModel 権限
lambdaFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:InvokeModel"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-*",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*",
    ],
  })
);

// Transcribe 権限
lambdaFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "transcribe:StartTranscriptionJob",
      "transcribe:GetTranscriptionJob",
    ],
    resources: ["*"],
  })
);

// S3 読み取り権限（Storage バケット参照）
lambdaFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:GetObject"],
    resources: [
      backend.storage.resources.bucket.bucketArn + "/audio/*",
    ],
  })
);
```

## Amplify Data スキーマパターン

### モデル定義 + カスタムID + GSI

```typescript
const schema = a.schema({
  // カスタムIDをPKに指定
  Cow: a.model({
    cowId: a.string().required(),
    name: a.string(),
    farm: a.string(),
  })
    .identifier(["cowId"])
    .authorization((allow) => [allow.authenticated()]),

  // GSI定義（ソートキー付き）
  Visit: a.model({
    visitId: a.string().required(),
    cowId: a.string().required(),
    datetime: a.datetime().required(),
    extractedJson: a.json(),
  })
    .identifier(["visitId"])
    .secondaryIndexes((index) => [
      // cowId をPK、datetime をSKとするGSI
      // queryField で自動生成されるクエリ名を指定
      index("cowId")
        .sortKeys(["datetime"])
        .queryField("listVisitsByCow"),
    ])
    .authorization((allow) => [allow.authenticated()]),
});
```

### フロントエンドからのクエリ

```typescript
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// 自動生成CRUD
const { data: cow } = await client.models.Cow.get({ cowId: "cow-123" });

// GSI経由のクエリ
const { data: visits } = await client.models.Visit.listVisitsByCow({
  cowId: "cow-123",
});

// カスタムクエリ
const { data, errors } = await client.queries.runPipeline({
  entryPoint: "PRODUCTION",
  cowId: "cow-123",
  audioKey: "audio/user-id/recording.wav",
});
```

## Bedrock 呼び出しパターン

### InvokeModel（基本）

```typescript
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const response = await client.send(
  new InvokeModelCommand({
    modelId: "amazon.nova-pro-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.1,
      },
    }),
  })
);

const result = JSON.parse(new TextDecoder().decode(response.body));
const text = result.output.message.content[0].text;
```

### Converse API（推奨）

Converse APIはモデル間の差異を吸収し、統一的なインターフェースを提供する。

```typescript
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const response = await client.send(
  new ConverseCommand({
    modelId: "amazon.nova-pro-v1:0",
    messages: [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.1,
    },
  })
);

const text = response.output?.message?.content?.[0]?.text;
```

### Structured Outputs（JSON Schema出力形式）

Bedrock の Structured Outputs 機能を使い、スキーマ準拠のJSON応答を保証する。

```typescript
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const response = await client.send(
  new ConverseCommand({
    modelId: "amazon.nova-pro-v1:0",
    messages: [
      {
        role: "user",
        content: [{ text: "以下の診療テキストから構造化JSONを抽出してください: ..." }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.1,
    },
    // Structured Outputs: JSON Schema で出力形式を強制
    outputConfig: {
      textFormat: {
        type: "json_schema",
        structure: {
          name: "ExtractedJSON",
          description: "獣医診療記録の構造化データ",
          schema: {
            type: "object",
            required: ["vital", "s", "o", "a", "p"],
            properties: {
              vital: {
                type: "object",
                properties: {
                  temp_c: { type: ["number", "null"] },
                },
                required: ["temp_c"],
              },
              s: { type: ["string", "null"] },
              o: { type: ["string", "null"] },
              a: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                  },
                },
              },
              p: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name", "type"],
                  properties: {
                    name: { type: "string" },
                    type: { enum: ["procedure", "drug"] },
                    dosage: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
);

// レスポンスは必ず指定したJSON Schemaに準拠
const extractedJson = JSON.parse(response.output?.message?.content?.[0]?.text);
```

## Lambda バンドリング: assets の扱い

Lambda関数からCSVマスタデータを読み込む場合、`assets/` ディレクトリをLambdaバンドルに含める必要がある。

### パス解決

```typescript
import * as fs from "fs";
import * as path from "path";

// Lambda実行時のパス（Amplify Gen 2のバンドル構造に依存）
// __dirname からの相対パスでassetsを参照
const csvPath = path.join(__dirname, "../../../assets/byoumei.csv");
const content = fs.readFileSync(csvPath, "utf-8");
```

### コールドスタート最適化

```typescript
// モジュールスコープでキャッシュ（Lambda再利用時にロード不要）
let cache: ParsedData | null = null;

function loadData(): ParsedData {
  if (cache) return cache;
  // CSVロード処理
  cache = parseCSV(fs.readFileSync(csvPath, "utf-8"));
  return cache;
}
```

## Amplify Storage パターン

### 音声ファイルアップロード（フロントエンド）

```typescript
import { uploadData } from "aws-amplify/storage";

const result = await uploadData({
  path: ({ identityId }) => `audio/${identityId}/${filename}`,
  data: audioBlob,
  options: {
    contentType: "audio/wav",
  },
}).result;
```

### S3からの読み取り（Lambda内）

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });
const response = await s3.send(
  new GetObjectCommand({
    Bucket: process.env.STORAGE_BUCKET_NAME,
    Key: audioKey,
  })
);
const audioBuffer = await response.Body?.transformToByteArray();
```

## エラーハンドリングパターン

### AppSync エラー（フロントエンド）

```typescript
try {
  const { data, errors } = await client.queries.runPipeline({ ... });
  if (errors) {
    // GraphQLエラー（バリデーション、認証等）
    console.error("AppSync errors:", errors);
  }
} catch (error) {
  // ネットワークエラー → オフラインキューに追加
  offlineQueue.enqueue({ type: "runPipeline", payload: { ... } });
}
```

### Bedrock リトライ（Lambda内）

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const BEDROCK_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

// ThrottlingException → リトライ
// ValidationException → リトライせずエラー返却
```

## モデル設定レイヤー

コンポーネント別にLLMモデルを切り替え可能にする設計:

```typescript
// amplify/data/handlers/model-config.ts
interface ModelConfig {
  modelId: string;
  region: string;
  maxTokens: number;
  temperature: number;
}

// デフォルト: Amazon Nova（コンペ推奨、低コスト）
// フォールバック: Claude（精度不足時）
function getModelConfig(
  component: "extractor" | "soapGenerator" | "kyosaiGenerator" | "historySummary"
): ModelConfig {
  // 環境変数 or デフォルト設定から取得
}
```

| コンポーネント | デフォルトモデル | 理由 |
|---------------|----------------|------|
| Extractor | Nova Pro | 高精度な構造化抽出が必要 |
| SOAP_Generator | Nova Lite | 低コスト、テキスト生成で十分 |
| Kyosai_Generator | Nova Lite | 低コスト、テキスト生成で十分 |
| HistorySummary | Nova Micro | 最低コスト、簡潔なサマリー |
