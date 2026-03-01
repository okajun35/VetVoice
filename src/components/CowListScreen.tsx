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
import { Button } from './ui/Button/Button';
import styles from './CowListScreen.module.css';

const client = generateClient<Schema>();

type CowListView = 'list' | 'detail' | 'edit' | 'register';

interface CowListScreenProps {
  onNavigateToVisit: (cowId: string) => void;
  onBack: () => void;
}

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
      setError(err instanceof Error ? err.message : 'REGISTRY_RETRIEVAL_FAILED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCows();
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
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
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
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
        >
          BACK
        </Button>
        <h2 className={styles.title}>COW_REGISTRY</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setView('register')}
        >
          NEW_ENTRY
        </Button>
      </div>

      {/* Search input */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="FILTER_BY_ID_NAME_BREED_OR_FARM..."
        className={styles.searchInput}
      />

      {/* Loading state */}
      {loading && (
        <div className={styles.loading}>
          FETCHING_DATABASE...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div role="alert" className={styles.errorAlert}>
          {error}
          <div className={styles.errorActions}>
            <Button
              variant="danger"
              size="sm"
              onClick={fetchCows}
            >
              RETRY_FETCH
            </Button>
          </div>
        </div>
      )}

      {/* Empty list state */}
      {!loading && !error && cows.length === 0 && (
        <div className={styles.emptyState}>
          NO_ENTRIES_FOUND_IN_REGISTRY
        </div>
      )}

      {/* No filter results */}
      {!loading && !error && cows.length > 0 && filteredCows.length === 0 && (
        <div className={styles.noResults}>
          NO_MATCHING_DATA_FOR_QUERY
        </div>
      )}

      {/* Cow list */}
      {!loading && !error && filteredCows.length > 0 && (
        <ul className={styles.cowList}>
          {filteredCows.map((cow) => (
            <li
              key={cow.cowId}
              onClick={() => { setSelectedCowId(cow.cowId); setView('detail'); }}
              className={styles.cowItem}
            >
              <span className={styles.cowId}>{cow.cowId}</span>
              <span className={styles.cowDetails}>
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
