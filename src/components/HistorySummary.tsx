/**
 * HistorySummary component
 * Task 25.1: History summary UI implementation
 * Requirements: 17.1
 */
import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface HistorySummaryProps {
  cowId: string;
}

export function HistorySummary({ cowId }: HistorySummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const { data, errors } = await client.queries.generateHistorySummary({ cowId });

      if (errors && errors.length > 0) {
        setError(errors.map((e) => e.message).join('\n'));
        return;
      }

      setSummary(data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サマリーの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const isNoHistory = summary === '診療履歴がありません';

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '0.5rem 1.25rem',
          background: loading ? '#aaa' : '#0066cc',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {loading && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        )}
        診療履歴サマリーを生成
      </button>

      {/* spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#fff0f0',
            border: '1px solid #cc0000',
            borderRadius: '4px',
            color: '#cc0000',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {summary !== null && !error && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            background: isNoHistory ? '#f5f5f5' : '#e8f4fd',
            border: `1px solid ${isNoHistory ? '#ccc' : '#90caf9'}`,
            borderRadius: '6px',
            color: isNoHistory ? '#888' : '#1a1a1a',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
          }}
        >
          {summary}
        </div>
      )}
    </div>
  );
}

export default HistorySummary;
