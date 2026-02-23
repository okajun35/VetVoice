import { defineStorage } from "@aws-amplify/backend";

/**
 * Amplify Storage (S3) configuration
 * 音声ファイルをユーザーごとに保存
 */
export const storage = defineStorage({
  name: "vetVoiceAudio",
  access: (allow) => ({
    "audio/{entity_id}/*": [
      allow.entity("identity").to(["read", "write", "delete"]),
    ],
  }),
});
