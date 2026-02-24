import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { QRScanner } from './components/QRScanner';
import { CowRegistrationForm } from './components/CowRegistrationForm';
import { VisitManager } from './components/VisitManager';
import { CowListScreen } from './components/CowListScreen';
import DevEntryPoints from './components/DevEntryPoints';

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
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>VetVoice</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {!devMode && view === 'qr' && (
                <button
                  type="button"
                  onClick={() => setView('cow_list')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.85rem',
                    background: '#fff',
                    border: '1px solid #0066cc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#0066cc',
                  }}
                >
                  牛一覧
                </button>
              )}
              <button
                type="button"
                onClick={() => setDevMode((v) => !v)}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.8rem',
                  background: devMode ? '#e8f0fe' : '#fff',
                  border: '1px solid #0066cc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#0066cc',
                }}
              >
                {devMode ? '開発モード ON' : '開発モード'}
              </button>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>
                {user?.signInDetails?.loginId}
              </span>
              <button
                type="button"
                onClick={signOut}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                サインアウト
              </button>
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
  );
}

export default App;
