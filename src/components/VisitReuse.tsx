/**
 * VisitReuse component
 * Task 26.1: Display past Visits for a cow and allow reusing one as a template
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { reuseVisit } from '../lib/visit-reuse';
import type { ReuseResult } from '../lib/visit-reuse';

const client = generateClient<Schema>();

export interface VisitReuseProps {
  cowId: string;
  onReuse: (result: ReuseResult) => void;
  onCancel: () => void;
}

interface VisitItem {
  visitId: string;
  cowId: string;
  datetime: string;
  extractedJson?: unknown;
  templateType?: string | null;
}

const containerStyle: React.CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
  padding: '1rem',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.4rem 1rem',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const visitCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  marginBottom: '0.5rem',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '0.9rem',
};

const reuseBtnStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  background: '#0066cc',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  whiteSpace: 'nowrap',
};

const errorStyle: React.CSSProperties = {
  padding: '0.75rem',
  background: '#fff0f0',
  border: '1px solid #cc0000',
  borderRadius: '4px',
  color: '#cc0000',
  marginBottom: '1rem',
};

export function VisitReuse({ cowId, onReuse, onCancel }: VisitReuseProps) {
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.models.Visit.listVisitsByCow({ cowId });
        if (result.errors && result.errors.length > 0) {
          setError(result.errors.map((e) => e.message).join('\n'));
          return;
        }
        const sorted = [...(result.data ?? [])].sort(
          (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
        );
        setVisits(
          sorted.map((v) => ({
            visitId: v.visitId,
            cowId: v.cowId,
            datetime: v.datetime,
            extractedJson: v.extractedJson ?? undefined,
            templateType: v.templateType ?? null,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, [cowId]);

  const handleReuse = (visit: VisitItem) => {
    const result = reuseVisit(visit);
    onReuse(result);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>過去の診療をテンプレートとして使用</h2>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>
          キャンセル
        </button>
      </div>

      {error && (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '1rem', color: '#555' }}>読み込み中...</div>
      ) : visits.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>過去の診療履歴がありません</p>
      ) : (
        <div>
          {visits.map((visit) => (
            <div key={visit.visitId} style={visitCardStyle}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>
                  {new Date(visit.datetime).toLocaleString('ja-JP')}
                </div>
                {visit.templateType && (
                  <div style={{ color: '#555', fontSize: '0.85rem' }}>
                    テンプレート: {visit.templateType}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleReuse(visit)}
                style={reuseBtnStyle}
              >
                このVisitをテンプレートとして使用
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VisitReuse;
