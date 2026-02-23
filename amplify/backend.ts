import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";

/**
 * Amplify Gen 2 バックエンド統合定義
 * Region: us-east-1 (バージニア北部)
 * 
 * Task 1: 基本構造を作成
 * Task 17: IAMポリシー（Bedrock, Transcribe, S3権限）を追加
 */
export const backend = defineBackend({
  auth,
  data,
  storage,
});

// Task 17でIAMポリシーを追加予定:
// - Bedrock InvokeModel 権限
// - Transcribe 権限
// - S3 読み取り権限
