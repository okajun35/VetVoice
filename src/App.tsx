import { useState } from 'react';
import { Authenticator, ThemeProvider, createTheme } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';
import { QRScanner } from './components/QRScanner';
import { CowRegistrationForm } from './components/CowRegistrationForm';
import { VisitManager } from './components/VisitManager';
import { CowListScreen } from './components/CowListScreen';
import DevEntryPoints from './components/DevEntryPoints';
import { Button } from './components/ui/Button/Button';
import styles from './App.module.css';

// Task 7.1: Configure Japanese translations for Amplify UI Authenticator
I18n.putVocabularies({
  ja: {
    'Sign In': 'サインイン',
    'Sign in': 'サインイン',
    'Sign Up': 'アカウント作成',
    'Sign Out': 'サインアウト',
    'Sign in to your account': 'アカウントにサインイン',
    'Username': 'ユーザー名',
    'Password': 'パスワード',
    'Enter your Username': 'ユーザー名を入力',
    'Enter your Password': 'パスワードを入力',
    'Forgot your password?': 'パスワードをお忘れですか？',
    'Reset Password': 'パスワードをリセット',
    'No account?': 'アカウントをお持ちでない方は',
    'Create account': 'アカウント作成',
    'Have an account?': 'アカウントをお持ちの方は',
    'Back to Sign In': 'サインインに戻る',
    'Send code': 'コードを送信',
    'Confirm': '確認',
    'Confirmation Code': '確認コード',
    'Enter your code': '確認コードを入力',
    'New Password': '新しいパスワード',
    'Email': 'メールアドレス',
    'Phone Number': '電話番号',
    'Incorrect username or password.': 'ユーザー名またはパスワードが正しくありません。',
    'User does not exist.': 'ユーザーが存在しません。',
    'User already exists': 'ユーザーはすでに存在します',
    'Invalid verification code provided, please try again.': '確認コードが無効です。もう一度お試しください。',
    'An account with the given email already exists.': 'このメールアドレスはすでに使用されています。',
    'Password did not conform with policy: Password not long enough': 'パスワードが短すぎます。',
    'Loading': '読み込み中',
  },
});
I18n.setLanguage('ja');

// Task 7.2: VetVoice theme - map design-system.css color tokens to Amplify UI theme tokens
// --color-primary: #1E6BFF, --color-primary-hover: #3B82FF, --color-primary-active: #1557D8
// --color-focus-ring: #93C5FD, --color-border-input: #D1D5DB
const vetVoiceTheme = createTheme({
  name: 'vet-voice-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          10: { value: '#C6FF00' },
          20: { value: '#C6FF00' },
          40: { value: '#C6FF00' },
          60: { value: '#C6FF00' },
          80: { value: '#C6FF00' },
          90: { value: '#B2E600' },
          100: { value: '#B2E600' },
        },
      },
      background: {
        primary: { value: '#121212' },
        secondary: { value: '#1A1A1A' },
      },
      font: {
        primary: { value: '#F5F5F5' },
        secondary: { value: '#AAAAAA' },
        tertiary: { value: '#666666' },
      },
      border: {
        primary: { value: '#2A2A2A' },
        secondary: { value: '#444444' },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '2px' },
          borderStyle: { value: 'solid' },
          borderColor: { value: '#2A2A2A' },
          boxShadow: { value: '0 8px 16px rgba(0,0,0,0.5)' },
          backgroundColor: { value: '#1A1A1A' },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: '#C6FF00' },
          color: { value: '#121212' },
          _hover: {
            backgroundColor: { value: '#D4FF33' },
          },
          _active: {
            backgroundColor: { value: '#B2E600' },
          },
        },
        link: {
          color: { value: '#C6FF00' },
        },
      },
      fieldcontrol: {
        borderColor: { value: '#333333' },
        color: { value: '#F5F5F5' },
        _focus: {
          borderColor: { value: '#C6FF00' },
          boxShadow: { value: '0 0 0 2px rgba(198, 255, 0, 0.5)' },
        },
      },
      tabs: {
        item: {
          _active: {
            color: { value: '#C6FF00' },
            borderColor: { value: '#C6FF00' },
          },
        },
      },
    },
    fonts: {
      default: {
        variable: { value: "'Outfit', sans-serif" },
        static: { value: "'Outfit', sans-serif" },
      },
    },
  },
});

/**
 * VetVoice main application
 * Task 30: Full component integration
 */

type AppView = 'qr' | 'register' | 'visit_manager' | 'cow_list';

function App() {
  const [view, setView] = useState<AppView>('qr');
  const [currentCowId, setCurrentCowId] = useState<string | null>(null);
  const [pendingCowId, setPendingCowId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  const handleCowFound = (cowId: string) => {
    setCurrentCowId(cowId);
    setView('visit_manager');
  };

  const handleNewCow = (cowId: string) => {
    setPendingCowId(cowId);
    setView('register');
  };

  const handleRegistered = (cowId: string) => {
    setCurrentCowId(cowId);
    setPendingCowId(null);
    setView('visit_manager');
  };

  const handleCancelRegistration = () => {
    setPendingCowId(null);
    setView('qr');
  };

  const handleBackToQr = () => {
    setCurrentCowId(null);
    setView('qr');
  };

  return (
    <ThemeProvider theme={vetVoiceTheme}>
      <Authenticator>
        {({ signOut, user }) => (
          <main className={styles.appMain}>
            <div className={styles.backgroundGrid} />
            <div className={styles.header}>
              <div className={styles.headerBrand}>
                <h1 className={styles.headerTitle}>VETVOICE</h1>
                <span className={styles.headerSubtitle}>PRECISION DIAGNOSTICS</span>
              </div>
              <div className={styles.headerActions}>
                {!devMode && view === 'qr' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setView('cow_list')}
                  >
                    REGISTRY
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={devMode ? styles.devModeActive : undefined}
                  onClick={() => setDevMode((v) => !v)}
                >
                  {devMode ? 'DEV ON' : 'DEV MODE'}
                </Button>
                <div className={styles.userBadge}>
                  <span className={styles.userId}>
                    {user?.signInDetails?.loginId?.split('@')[0].toUpperCase()}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className={styles.signOutButton}
                >
                  EXIT
                </Button>
              </div>
            </div>

            {devMode ? (
              <DevEntryPoints />
            ) : (
              <>
                {view === 'qr' && (
                  <QRScanner onCowFound={handleCowFound} onNewCow={handleNewCow} />
                )}

                {view === 'register' && (
                  <CowRegistrationForm
                    initialCowId={pendingCowId ?? ''}
                    onRegistered={handleRegistered}
                    onCancel={handleCancelRegistration}
                  />
                )}

                {view === 'visit_manager' && currentCowId && (
                  <VisitManager cowId={currentCowId} onBack={handleBackToQr} />
                )}

                {view === 'cow_list' && (
                  <CowListScreen
                    onNavigateToVisit={(cowId) => {
                      setCurrentCowId(cowId);
                      setView('visit_manager');
                    }}
                    onBack={() => setView('qr')}
                  />
                )}
              </>
            )}
          </main>
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

export default App;
