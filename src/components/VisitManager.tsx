/**
 * VisitManager component
 * Task 20: Cow info display + Visit management (new/existing)
 * Requirements: 2.1, 2.2, 2.3, 2.4, 19.5
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { VisitEditor } from './VisitEditor';
import { PipelineEntryForm } from './PipelineEntryForm';

const client = generateClient<Schema>();

interface VisitManagerProps {
  cowId: string;
  onBack?: () => void;
}

type ViewMode = 'list' | 'new_visit' | 'visit_detail';

type CowData = Awaited<ReturnType<typeof client.models.Cow.get>>['data'];

interface VisitItem {
  visitId: string;
  cowId: string;
  datetime: string;
  status?: string | null;
  templateType?: string | null;
}

const SEX_LABELS: Record<string, string> = {
  FEMALE: '雌',
  MALE: '雄',
  CASTRATED: '去勢',
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: '進行中',
  COMPLETED: '完了',
};

const cardStyle: React.CSSProperties = {
  padding: '1rem',
  background: '#fafafa',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  marginBottom: '1.5rem',
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '0.35rem',
  fontSize: '0.9rem',
};

export function VisitManager({ cowId, onBack }: VisitManagerProps) {
  const [cow, setCow] = useState<CowData | null>(null);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cowResult, visitsResult] = await Promise.all([
        client.models.Cow.get({ cowId }),
        client.models.Visit.listVisitsByCow({ cowId }),
      ]);

      if (cowResult.errors && cowResult.errors.length > 0) {
        setError(cowResult.errors.map((e) => e.message).join('\n'));
        return;
      }
      setCow(cowResult.data);

      if (visitsResult.errors && visitsResult.errors.length > 0) {
        setError(visitsResult.errors.map((e) => e.message).join('\n'));
        return;
      }

      const sorted = [...(visitsResult.data ?? [])].sort(
        (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      );
      setVisits(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cowId]);

  const handleSelectVisit = (visitId: string) => {
    setSelectedVisitId(visitId);
    setView('visit_detail');
  };

  const handleBackToList = () => {
    setSelectedVisitId(null);
    setView('list');
    fetchData();
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>読み込み中...</div>;
  }

  if (view === 'visit_detail' && selectedVisitId) {
    return (
      <VisitEditor
        visitId={selectedVisitId}
        onBack={handleBackToList}
        onSaved={handleBackToList}
      />
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{ marginBottom: '1rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
        >
          ← 戻る
        </button>
      )}

      {error && (
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
        </div>
      )}

      {cow && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>牛情報</h2>
          <div style={infoRowStyle}>
            <span style={{ fontWeight: 'bold', minWidth: '120px' }}>個体識別番号:</span>
            <span>{cow.cowId}</span>
          </div>
          {cow.earTagNo && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>耳標番号:</span>
              <span>{cow.earTagNo}</span>
            </div>
          )}
          {cow.sex && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>性別:</span>
              <span>{SEX_LABELS[cow.sex] ?? cow.sex}</span>
            </div>
          )}
          {cow.breed && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>品種:</span>
              <span>{cow.breed}</span>
            </div>
          )}
          {cow.birthDate && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>生年月日:</span>
              <span>{cow.birthDate}</span>
            </div>
          )}
          {cow.parity != null && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>産次:</span>
              <span>{cow.parity}</span>
            </div>
          )}
          {cow.lastCalvingDate && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>最終分娩日:</span>
              <span>{cow.lastCalvingDate}</span>
            </div>
          )}
          {cow.name && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>名前:</span>
              <span>{cow.name}</span>
            </div>
          )}
          {cow.farm && (
            <div style={infoRowStyle}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>農場:</span>
              <span>{cow.farm}</span>
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>診療履歴</h2>
            <button
              type="button"
              onClick={() => setView('new_visit')}
              style={{
                padding: '0.5rem 1rem',
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              新規診療を開始
            </button>
          </div>

          {visits.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>診療履歴がありません</p>
          ) : (
            <div>
              {visits.map((visit) => (
                <button
                  key={visit.visitId}
                  type="button"
                  onClick={() => handleSelectVisit(visit.visitId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {new Date(visit.datetime).toLocaleString('ja-JP')}
                  </div>
                  <div style={{ color: '#555', display: 'flex', gap: '1rem' }}>
                    {visit.templateType && <span>テンプレート: {visit.templateType}</span>}
                    {visit.status && (
                      <span
                        style={{
                          color: visit.status === 'COMPLETED' ? '#155724' : '#856404',
                        }}
                      >
                        {STATUS_LABELS[visit.status] ?? visit.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'new_visit' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setView('list')}
              style={{
                padding: '0.4rem 1rem',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ← 戻る
            </button>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>新規診療</h2>
          </div>
          <PipelineEntryForm
            cowId={cowId}
            mode="production"
            onPipelineComplete={(result) => {
              setSelectedVisitId(result.visitId);
              setView('visit_detail');
            }}
            onError={(msg) => setError(msg)}
          />
        </div>
      )}
    </div>
  );
}

export default VisitManager;
