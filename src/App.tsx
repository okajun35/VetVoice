import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';

// Amplify設定を初期化
Amplify.configure(outputs);

/**
 * VetVoice メインアプリケーション
 * 
 * Task 1: 基本構造とAmplify認証統合
 * Task 30: 全コンポーネントの統合とルーティング
 */
function App() {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Amplify設定の確認
    setIsConfigured(true);
  }, []);

  if (!isConfigured) {
    return <div>Loading...</div>;
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          <h1>VetVoice - 獣医音声診療記録システム</h1>
          <p>ユーザー: {user?.signInDetails?.loginId}</p>
          <button onClick={signOut}>サインアウト</button>
          
          <div style={{ marginTop: '2rem' }}>
            <p>プロジェクト初期化完了</p>
            <p>Task 2以降でコンポーネントを実装します</p>
          </div>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
