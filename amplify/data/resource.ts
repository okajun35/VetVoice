import { type ClientSchema, a, defineData, defineFunction } from "@aws-amplify/backend";

/**
 * Amplify Data スキーマ定義
 * Task 2: 完全なスキーマとカスタムクエリを実装
 */

// Lambda関数定義（Task 15, 16で実装）
const runPipelineFunction = defineFunction({
  name: "runPipeline",
  entry: "./run-pipeline.ts",
  timeoutSeconds: 120,  // パイプライン全体の処理時間を考慮
  memoryMB: 512,
});

const generateHistorySummaryFunction = defineFunction({
  name: "generateHistorySummary",
  entry: "./generate-history-summary.ts",
  timeoutSeconds: 30,
  memoryMB: 256,
});

const schema = a.schema({
  // --- Enum定義 ---
  CowSex: a.enum(['FEMALE', 'MALE', 'CASTRATED']),

  // --- モデル定義 ---
  Cow: a.model({
    cowId: a.string().required(),       // 個体識別番号（10桁、先頭0あり）
    earTagNo: a.string(),               // 耳標番号（任意）
    sex: a.ref('CowSex'),               // 性別（雌/雄/去勢）
    breed: a.string(),                  // 品種
    birthDate: a.date(),                // 生年月日
    parity: a.integer(),                // 産次/分娩回数（任意）
    lastCalvingDate: a.date(),          // 最終分娩日（任意）
    name: a.string(),                   // 牛の名前（任意）
    farm: a.string(),                   // 農場名（任意）
    createdAt: a.datetime(),
  })
    .identifier(["cowId"])
    .authorization((allow) => [allow.authenticated()]),

  Visit: a.model({
    visitId: a.string().required(),
    cowId: a.string().required(),
    datetime: a.datetime().required(),
    status: a.enum(["IN_PROGRESS", "COMPLETED"]),
    transcriptRaw: a.string(),
    transcriptExpanded: a.string(),
    extractedJson: a.json(),
    soapText: a.string(),
    kyosaiText: a.string(),
    templateType: a.string(),       // 要件16: テンプレートタイプ
    updatedAt: a.datetime(),
  })
    .identifier(["visitId"])
    .secondaryIndexes((index) => [
      index("cowId").sortKeys(["datetime"]).queryField("listVisitsByCow"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // --- カスタム型定義 ---
  PipelineOutput: a.customType({
    visitId: a.string().required(),
    cowId: a.string().required(),
    transcriptRaw: a.string(),
    transcriptExpanded: a.string(),
    extractedJson: a.json(),
    soapText: a.string(),
    kyosaiText: a.string(),
    templateType: a.string(),
    warnings: a.string().array(),
  }),

  // --- カスタムクエリ ---
  runPipeline: a.query()
    .arguments({
      entryPoint: a.enum(["PRODUCTION", "TEXT_INPUT", "AUDIO_FILE", "JSON_INPUT"]),
      cowId: a.string().required(),
      audioKey: a.string(),           // S3キー（音声ファイル）
      transcriptText: a.string(),     // テキスト直接入力
      extractedJson: a.json(),        // JSON直接入力
      templateType: a.string(),       // 手動テンプレート指定（任意）
    })
    .returns(a.ref("PipelineOutput"))
    .handler(a.handler.function(runPipelineFunction))
    .authorization((allow) => [allow.authenticated()]),

  generateHistorySummary: a.query()
    .arguments({
      cowId: a.string().required(),
    })
    .returns(a.string())
    .handler(a.handler.function(generateHistorySummaryFunction))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
