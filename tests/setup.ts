/**
 * Vitest グローバルセットアップ
 * テスト実行前の共通設定
 */

// Import design system CSS for tests
import '../src/styles/reset.css';
import '../src/styles/global.css';
import '../src/styles/design-system.css';

// Import React Testing Library matchers
import '@testing-library/jest-dom';

// Mock Amplify outputs for testing
vi.mock('../amplify_outputs.json', () => ({
  default: {
    version: '1',
    auth: {
      user_pool_id: 'test-pool-id',
      aws_region: 'us-east-1',
      user_pool_client_id: 'test-client-id',
      identity_pool_id: 'test-identity-pool-id',
    },
    data: {
      url: 'https://test-api.appsync-api.us-east-1.amazonaws.com/graphql',
      aws_region: 'us-east-1',
      default_authorization_type: 'AMAZON_COGNITO_USER_POOLS',
    },
    storage: {
      bucket_name: 'test-bucket',
      aws_region: 'us-east-1',
    },
  },
}));
