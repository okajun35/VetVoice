/**
 * CowListScreen component
 * Tasks 7.1 + 7.2: Main container with sub-view management
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4,
 *               3.1, 3.2, 3.3, 3.4, 4.4, 4.6, 5.1, 6.2, 6.4
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { filterCows, type CowData } from '../lib/cow-filter';
import { CowDetailView } from './CowDetailView';
import { CowRegistrationForm } from './CowRegistrationForm';
import { QRCodeDisplay } from './QRCodeDisplay';

const client = generateClient<Schema>();

type CowListView = 'list' | 'detail' | 'edit' | 'register';

interface CowListScreenProps {
  onNavigateToVisit: (cowId: string) => void;
  onBack: () => void;
}

const buttonStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.95rem',
  cursor: 'pointer',
};

export function CowListScreen({ onNavigateToVisit, onBack }: CowListScreenProps) {
  const [view, setView] = useState<CowListView>('list');
  const [cows, setCows] = useState<CowData[]>([]);
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const fetchCows = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await client.models.Cow.list();
      if (errors && errors.length > 0) {
        setError(errors.map((e) => e.message).join('\n'));
        return;
      }
      setCows((data ?? []) as CowData[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '牛一覧の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Sub-views ---

  if (view === 'detail' && selectedCowId) {
    return (
      <>
        <CowDetailView
          cowId={selectedCowId}
          onEdit={() => setView('edit')}
          onGenerateQR={() => setShowQR(true)}
          onStartVisit={(cowId) => onNavigateToVisit(cowId)}
          onBack={() => { setView('list'); fetchCows(); }}
        />
        {showQR && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ background: '#fff', borderRadius: '8px', padding: '1rem' }}>
              <QRCodeDisplay
                cowId={selectedCowId}
                onClose={() => setShowQR(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  if (view === 'edit' && selectedCowId) {
    return (
      <CowRegistrationForm
        mode="edit"
        initialCowId={selectedCowId}
        onRegistered={() => { setView('detail'); }}
        onCancel={() => setView('detail')}
      />
    );
  }

  if (view === 'register') {
    return (
      <CowRegistrationForm
        mode="create"
        onRegistered={(cowId) => { setSelectedCowId(cowId); fetchCows(); setView('list'); }}
        onCancel={() => setView('list')}
      />
    );
  }

  // --- List view ---

  const filteredCows = filterCows(cows, searchQuery);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ ...buttonStyle, background: 'none', border: '1px solid #ccc', color: '#333' }}
        >
          ← 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>牛一覧</h2>
        <button
          type="button"
          onClick={() => setView('register')}
          style={{ ...buttonStyle, background: '#0066cc', color: '#fff' }}
        >
          新規登録
        </button>
      </div>

      {/* Search input */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="個体識別番号・名前・品種・農場で検索"
        style={{
          width: '100%',
          padding: '0.5rem',
          fontSize: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
          marginBottom: '1rem',
        }}
      />

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#555', padding: '1rem' }}>
          読み込み中...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem',
            background: '#fff0f0',
            border: '1px solid #cc0000',
            borderRadius: '4px',
            color: '#cc0000',
            marginBottom: '1rem',
          }}
        >
          {error}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={fetchCows}
              style={{ ...buttonStyle, background: '#cc0000', color: '#fff', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              再取得
            </button>
          </div>
        </div>
      )}

      {/* Empty list state */}
      {!loading && !error && cows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', padding: '2rem' }}>
          登録済みの牛がありません
        </div>
      )}

      {/* No filter results */}
      {!loading && !error && cows.length > 0 && filteredCows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', padding: '2rem' }}>
          該当する牛が見つかりません
        </div>
      )}

      {/* Cow list */}
      {!loading && !error && filteredCows.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filteredCows.map((cow) => (
            <li
              key={cow.cowId}
              onClick={() => { setSelectedCowId(cow.cowId); setView('detail'); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '0.75rem',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: '#fff',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = '#f5f9ff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = '#fff'; }}
            >
              <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{cow.cowId}</span>
              <span style={{ fontSize: '0.9rem', color: '#555' }}>
                {[cow.name, cow.breed, cow.farm].filter(Boolean).join(' / ') || '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CowListScreen;
