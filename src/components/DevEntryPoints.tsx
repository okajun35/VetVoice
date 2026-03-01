/**
 * Development entry points UI
 *
 * Refactored: wraps PipelineEntryForm and provides explicit navigation
 * to VisitManager / VisitEditor for manual correction workflow checks.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import { useState } from 'react';
import { PipelineEntryForm } from './PipelineEntryForm';
import type { PipelineResult } from './PipelineEntryForm';
import { VisitManager } from './VisitManager';
import { VisitEditor } from './VisitEditor';
import { Button } from './ui/Button/Button';

export function DevEntryPoints() {
  const [cowId, setCowId] = useState('test-cow-001');
  const [visitIdInput, setVisitIdInput] = useState('');
  const [latestVisitId, setLatestVisitId] = useState<string | null>(null);
  const [view, setView] = useState<'entry' | 'visit_manager' | 'visit_editor'>('entry');
  const [visitIdToEdit, setVisitIdToEdit] = useState<string | null>(null);

  const openVisitEditor = (visitId: string) => {
    setVisitIdToEdit(visitId);
    setView('visit_editor');
  };

  if (view === 'visit_manager') {
    return <VisitManager cowId={cowId} onBack={() => setView('entry')} />;
  }

  if (view === 'visit_editor' && visitIdToEdit) {
    return (
      <VisitEditor
        visitId={visitIdToEdit}
        onBack={() => setView('entry')}
        onSaved={() => setView('entry')}
      />
    );
  }

  return (
    <div className="dev-entry-points">
      <h2>開発用エントリポイント</h2>
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="dev-cow-id-input">Cow ID:</label>{' '}
        <input
          id="dev-cow-id-input"
          type="text"
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          placeholder="test-cow-001"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          style={{ marginLeft: '8px' }}
          onClick={() => setView('visit_manager')}
        >
          Visit一覧を開く
        </Button>
      </div>
      <PipelineEntryForm
        cowId={cowId}
        mode="dev"
        onPipelineComplete={(result: PipelineResult) => {
          if (result.visitId) {
            setLatestVisitId(result.visitId);
            setVisitIdInput(result.visitId);
          }
        }}
      />
      <div style={{ marginTop: '16px' }}>
        <h3>編集導線</h3>
        <div style={{ marginBottom: '8px' }}>
          <label htmlFor="dev-visit-id-input">Visit ID:</label>{' '}
          <input
            id="dev-visit-id-input"
            type="text"
            value={visitIdInput}
            onChange={(e) => setVisitIdInput(e.target.value)}
            placeholder="visit-uuid"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            style={{ marginLeft: '8px' }}
            onClick={() => {
              if (!visitIdInput.trim()) return;
              openVisitEditor(visitIdInput.trim());
            }}
            disabled={!visitIdInput.trim()}
          >
            Visit編集を開く
          </Button>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            if (!latestVisitId) return;
            openVisitEditor(latestVisitId);
          }}
          disabled={!latestVisitId}
        >
          最新実行結果を編集
        </Button>
      </div>
    </div>
  );
}

export default DevEntryPoints;
