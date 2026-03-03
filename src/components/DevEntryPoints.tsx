/**
 * Development entry points UI
 *
 * Refactored: wraps PipelineEntryForm and provides explicit navigation
 * to VisitManager / VisitEditor for manual correction workflow checks.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import { useState } from 'react';
import { PipelineEntryForm } from './PipelineEntryForm';
import { VisitManager } from './VisitManager';
import { VisitEditor } from './VisitEditor';
import { Button } from './ui/Button/Button';
import styles from './DevEntryPoints.module.css';

export function DevEntryPoints() {
  const [cowId, setCowId] = useState('test-cow-001');
  const [latestVisitId, setLatestVisitId] = useState<string | null>(null);
  const [view, setView] = useState<'entry' | 'visit_manager' | 'visit_edit'>('entry');

  return (
    <div className={styles.container}>
      <div style={{ display: view === 'entry' ? 'block' : 'none' }}>
        <h2 className={styles.heading}>Development Entry Points</h2>
        <div className={styles.controlRow}>
          <label htmlFor="dev-cow-id-input" className={styles.label}>
            Cow ID:
          </label>
          <input
            id="dev-cow-id-input"
            type="text"
            value={cowId}
            onChange={(e) => {
              setCowId(e.target.value);
              setLatestVisitId(null);
            }}
            placeholder="test-cow-001"
            className={styles.input}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.openListButton}
            onClick={() => setView('visit_manager')}
          >
            Open Visit List
          </Button>
        </div>
        <PipelineEntryForm
          cowId={cowId}
          mode="dev"
          showCowIdInput={false}
          onPipelineComplete={(result) => {
            setLatestVisitId(result.visitId);
          }}
        />
        {latestVisitId && (
          <div className={styles.resultActionRow}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setView('visit_edit')}
              title={`Edit ${latestVisitId}`}
            >
              Edit Latest Result
            </Button>
          </div>
        )}
      </div>

      {view === 'visit_edit' && latestVisitId && (
        <VisitEditor
          visitId={latestVisitId}
          mode="edit"
          onBack={() => setView('entry')}
          onSaved={() => setView('entry')}
        />
      )}

      {view === 'visit_manager' && (
        <VisitManager cowId={cowId} onBack={() => setView('entry')} />
      )}
    </div>
  );
}

export default DevEntryPoints;
