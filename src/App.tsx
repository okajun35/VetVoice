import { useCallback, useEffect, useRef, useState } from 'react';
import { Authenticator, ThemeProvider, createTheme } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '../amplify/data/resource';
import { QRScanner } from './components/QRScanner';
import { CowRegistrationForm } from './components/CowRegistrationForm';
import { VisitManager } from './components/VisitManager';
import { CowListScreen } from './components/CowListScreen';
import DevEntryPoints from './components/DevEntryPoints';
import { Alert } from './components/ui/Alert/Alert';
import { Button } from './components/ui/Button/Button';
import {
  clearCowIdQueryFromHref,
  clearPendingQrCowId,
  getCowIdFromSearch,
  persistPendingQrCowId,
  readPendingQrCowId,
} from './lib/qr-links';
import styles from './App.module.css';


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

const client = generateClient<Schema>();

interface AuthenticatedAppShellProps {
  currentCowId: string | null;
  devMode: boolean;
  onBackToQr: () => void;
  onCancelRegistration: () => void;
  onCowFound: (cowId: string) => void;
  onNavigateHome: () => void;
  onNewCow: (cowId: string) => void;
  onRegistered: (cowId: string) => void;
  onSelectCowList: () => void;
  onToggleDevMode: () => void;
  pendingCowId: string | null;
  pendingLaunchCowId: string | null;
  qrScannerResetKey: number;
  setPendingLaunchCowId: (cowId: string | null) => void;
  signOut?: (() => void) | undefined;
  user?: { signInDetails?: { loginId?: string } } | undefined;
  view: AppView;
}

function AuthenticatedAppShell({
  currentCowId,
  devMode,
  onBackToQr,
  onCancelRegistration,
  onCowFound,
  onNavigateHome,
  onNewCow,
  onRegistered,
  onSelectCowList,
  onToggleDevMode,
  pendingCowId,
  pendingLaunchCowId,
  qrScannerResetKey,
  setPendingLaunchCowId,
  signOut,
  user,
  view,
}: AuthenticatedAppShellProps) {
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const launchInFlightRef = useRef(false);

  const handleNavigateHome = useCallback(() => {
    setLaunchMessage(null);
    onNavigateHome();
  }, [onNavigateHome]);

  useEffect(() => {
    if (!pendingLaunchCowId || launchInFlightRef.current) {
      return;
    }

    let cancelled = false;
    launchInFlightRef.current = true;
    setLaunchMessage(null);

    const resolveLaunch = async () => {
      try {
        const { data: cow, errors } = await client.models.Cow.get({ cowId: pendingLaunchCowId });
        if (cancelled) return;

        if (errors && errors.length > 0) {
          setLaunchMessage('Failed to retrieve cow data. Please try again from the top page.');
          onBackToQr();
          return;
        }

        if (cow) {
          onCowFound(pendingLaunchCowId);
          return;
        }

        setLaunchMessage('Cow not found. Please register from the top page.');
        onBackToQr();
      } catch {
        if (cancelled) return;
        setLaunchMessage('Failed to retrieve cow data. Please try again from the top page.');
        onBackToQr();
      } finally {
        launchInFlightRef.current = false;
        clearPendingQrCowId(window.sessionStorage);
        if (!cancelled) {
          setPendingLaunchCowId(null);
        }
      }
    };

    void resolveLaunch();

    return () => {
      cancelled = true;
    };
  }, [onBackToQr, onCowFound, pendingLaunchCowId, setPendingLaunchCowId]);

  return (
    <main className={styles.appMain}>
      <div className={styles.backgroundGrid} />
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerBrandButton}
          onClick={handleNavigateHome}
          aria-label="Go to top page"
        >
          <h1 className={styles.headerTitle}>VETVOICE</h1>
          <span className={styles.headerSubtitle}>PRECISION DIAGNOSTICS</span>
        </button>
        <div className={styles.headerActions}>
          {!devMode && view === 'qr' && (
            <Button type="button" variant="secondary" size="sm" onClick={onSelectCowList}>
              REGISTRY
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={devMode ? styles.devModeActive : undefined}
            onClick={onToggleDevMode}
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

      {launchMessage && view === 'qr' && (
        <Alert variant="warning" className={styles.launchAlert}>
          {launchMessage}
        </Alert>
      )}

      {devMode ? (
        <DevEntryPoints />
      ) : (
        <>
          {view === 'qr' && (
            <QRScanner
              key={qrScannerResetKey}
              onCowFound={onCowFound}
              onNewCow={onNewCow}
            />
          )}

          {view === 'register' && (
            <CowRegistrationForm
              initialCowId={pendingCowId ?? ''}
              onRegistered={onRegistered}
              onCancel={onCancelRegistration}
            />
          )}

          {view === 'visit_manager' && currentCowId && (
            <VisitManager cowId={currentCowId} onBack={onBackToQr} />
          )}

          {view === 'cow_list' && (
            <CowListScreen
              onNavigateToVisit={onCowFound}
              onBack={onBackToQr}
            />
          )}
        </>
      )}
    </main>
  );
}

function App() {
  const [view, setView] = useState<AppView>('qr');
  const [currentCowId, setCurrentCowId] = useState<string | null>(null);
  const [pendingCowId, setPendingCowId] = useState<string | null>(null);
  const [pendingLaunchCowId, setPendingLaunchCowId] = useState<string | null>(null);
  const [qrScannerResetKey, setQrScannerResetKey] = useState(0);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const queryCowId = getCowIdFromSearch(window.location.search);
    const storedCowId = readPendingQrCowId(window.sessionStorage);
    const launchCowId = queryCowId ?? storedCowId;

    if (queryCowId) {
      persistPendingQrCowId(queryCowId, window.sessionStorage);
      window.history.replaceState({}, document.title, clearCowIdQueryFromHref(window.location.href));
    }

    setPendingLaunchCowId(launchCowId);
  }, []);

  const handleCowFound = useCallback((cowId: string) => {
    setCurrentCowId(cowId);
    setView('visit_manager');
  }, []);

  const handleNewCow = useCallback((cowId: string) => {
    setPendingCowId(cowId);
    setView('register');
  }, []);

  const handleRegistered = useCallback((cowId: string) => {
    setCurrentCowId(cowId);
    setPendingCowId(null);
    setView('visit_manager');
  }, []);

  const handleCancelRegistration = useCallback(() => {
    setPendingCowId(null);
    setQrScannerResetKey((value) => value + 1);
    setView('qr');
  }, []);

  const handleBackToQr = useCallback(() => {
    setCurrentCowId(null);
    setQrScannerResetKey((value) => value + 1);
    setView('qr');
  }, []);

  const handleNavigateHome = useCallback(() => {
    clearPendingQrCowId(window.sessionStorage);
    setPendingLaunchCowId(null);
    setPendingCowId(null);
    setCurrentCowId(null);
    setQrScannerResetKey((value) => value + 1);
    setDevMode(false);
    setView('qr');
  }, []);

  return (
    <ThemeProvider theme={vetVoiceTheme}>
      <Authenticator>
        {({ signOut, user }) => (
          <AuthenticatedAppShell
            currentCowId={currentCowId}
            devMode={devMode}
            onBackToQr={handleBackToQr}
            onCancelRegistration={handleCancelRegistration}
            onCowFound={handleCowFound}
            onNavigateHome={handleNavigateHome}
            onNewCow={handleNewCow}
            onRegistered={handleRegistered}
            onSelectCowList={() => setView('cow_list')}
            onToggleDevMode={() => setDevMode((value) => !value)}
            pendingCowId={pendingCowId}
            pendingLaunchCowId={pendingLaunchCowId}
            qrScannerResetKey={qrScannerResetKey}
            setPendingLaunchCowId={setPendingLaunchCowId}
            signOut={signOut}
            user={user}
            view={view}
          />
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

export default App;
