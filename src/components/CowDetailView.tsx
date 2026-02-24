/**
 * CowDetailView component
 * Task 6: Display cow details with navigation actions
 * Requirements: 4.1, 4.2, 5.1, 6.2, 6.3
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { CowData } from '../lib/cow-filter';

const client = generateClient<Schema>();

interface CowDetailViewProps {
  cowId: string;
  onEdit: () => void;
  onGenerateQR: () => void;
  onStartVisit: (cowId: string) => void;
  onBack: () => void;
}

const SEX_LABELS: Record<string, string> = {
  FEMALE: '雌',
  MALE: '雄',
  CASTRATED: '去勢',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #eee',
  padding: '0.5rem 0',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  width: '140px',
  flexShrink: 0,
  color: '#555',
  fontSize: '0.9rem',
};

const valueStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '0.95rem',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.95rem',
  cursor: 'pointer',
};

export function CowDetailView({
  cowId,
  onEdit,
  onGenerateQR,
  onStartVisit,
  onBack,
}: CowDetailViewProps) {
  const [cow, setCow] = useState<CowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCow = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await client.models.Cow.get({ cowId });
      if (errors && errors.length > 0) {
        setError(errors.map((e) => e.message).join('\n'));
        return;
      }
      setCow(data as CowData | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '牛データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cowId]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#555' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ ...buttonStyle, background: 'none', border: '1px solid #ccc', color: '#333' }}
        >
          ← 戻る
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>牛の詳細</h2>
      </div>

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
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={fetchCow}
              style={{ ...buttonStyle, background: '#cc0000', color: '#fff', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              再取得
            </button>
          </div>
        </div>
      )}

      {!error && !cow && (
        <div style={{ padding: '1rem', color: '#555', textAlign: 'center' }}>
          牛が見つかりません
        </div>
      )}

      {cow && (
        <>
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={rowStyle}>
              <span style={labelStyle}>個体識別番号</span>
              <span style={valueStyle}>{cow.cowId}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>耳標番号</span>
              <span style={valueStyle}>{cow.earTagNo ?? '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>性別</span>
              <span style={valueStyle}>{cow.sex ? (SEX_LABELS[cow.sex] ?? cow.sex) : '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>品種</span>
              <span style={valueStyle}>{cow.breed ?? '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>生年月日</span>
              <span style={valueStyle}>{cow.birthDate ?? '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>産次</span>
              <span style={valueStyle}>{cow.parity != null ? String(cow.parity) : '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>最終分娩日</span>
              <span style={valueStyle}>{cow.lastCalvingDate ?? '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>名前</span>
              <span style={valueStyle}>{cow.name ?? '—'}</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>農場名</span>
              <span style={valueStyle}>{cow.farm ?? '—'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onStartVisit(cow.cowId)}
              style={{ ...buttonStyle, background: '#0066cc', color: '#fff', fontWeight: 'bold' }}
            >
              診療開始
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onEdit}
                style={{ ...buttonStyle, flex: 1, background: '#fff', border: '1px solid #0066cc', color: '#0066cc' }}
              >
                編集
              </button>
              <button
                type="button"
                onClick={onGenerateQR}
                style={{ ...buttonStyle, flex: 1, background: '#fff', border: '1px solid #555', color: '#333' }}
              >
                QRコード生成
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CowDetailView;
