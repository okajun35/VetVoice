import { defineAuth } from "@aws-amplify/backend";

/**
 * Amplify Auth (Cognito) configuration
 * PoC用: テストユーザーを手動でCognitoコンソールから作成
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
