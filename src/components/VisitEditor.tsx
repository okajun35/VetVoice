/**
 * VisitEditor component
 * Task 22.1: Display and edit Visit data including ExtractedJSON
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface VisitEditorProps {
  visitId: string;
  onBack?: () => void;
  onSaved?: () => void;
}

interface ExtractedJSON {
  vital: { temp_c: number | null };
  s: string | null;
  o: string | null;
  a: Array<{
    name: string;
    confidence?: number;
    master_code?: string;
    status?: 'confirmed' | 'unconfirmed';
  }>;
  p: Array<{
    name: string;
    type: 'procedure' | 'drug';
    dosage?: string;
    confidence?: number;
    master_code?: string;
    status?: 'confirmed' | 'unconfirmed';
  }>;
}

interface VisitData {
  visitId: string;
  cowId: string;
  datetime: string;
  status?: string | null;
  templateType?: string | null;
  transcriptRaw?: string | null;
  extractedJson?: unknown;
  soapText?: string | null;
  kyosaiText?: string | null;
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1rem',
  background: '#fafafa',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.75rem 0',
  fontSize: '1rem',
  fontWeight: 'bold',
  color: '#333',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '0.95rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const confirmedBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.4rem',
  background: '#d4edda',
  color: '#155724',
  borderRadius: '3px',
  fontSize: '0.75rem',
  marginLeft: '0.5rem',
};

const unconfirmedBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.4rem',
  background: '#fff3cd',
  color: '#856404',
  borderRadius: '3px',
  fontSize: '0.75rem',
  marginLeft: '0.5rem',
};

export function VisitEditor({ visitId, onBack, onSaved }: VisitEditorProps) {
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [extractedJson, setExtractedJson] = useState<ExtractedJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisit = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, errors } = await client.models.Visit.get({ visitId });
        if (errors && errors.length > 0) {
          setError(errors.map((e) => e.message).join('\n'));
          return;
        }
        setVisit(data);
        if (data?.extractedJson) {
          try {
            const parsed =
              typeof data.extractedJson === 'string'
                ? JSON.parse(data.extractedJson)
                : data.extractedJson;
            setExtractedJson(parsed as ExtractedJSON);
          } catch {
            setError('ExtractedJSONの解析に失敗しました');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchVisit();
  }, [visitId]);

  const handleSave = async () => {
    if (!visit || !extractedJson) return;
    setSaving(true);
    setError(null);
    try {
      const { errors } = await client.models.Visit.update({
        visitId,
        extractedJson: JSON.stringify(extractedJson),
      });
      if (errors && errors.length > 0) {
        setError(errors.map((e) => e.message).join('\n'));
        return;
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const updateVitalTemp = (value: string) => {
    if (!extractedJson) return;
    const num = value === '' ? null : parseFloat(value);
    setExtractedJson({ ...extractedJson, vital: { temp_c: isNaN(num as number) ? null : num } });
  };

  const updateS = (value: string) => {
    if (!extractedJson) return;
    setExtractedJson({ ...extractedJson, s: value || null });
  };

  const updateO = (value: string) => {
    if (!extractedJson) return;
    setExtractedJson({ ...extractedJson, o: value || null });
  };

  const confirmAItem = (index: number) => {
    if (!extractedJson) return;
    const updated = extractedJson.a.map((item, i) =>
      i === index ? { ...item, status: 'confirmed' as const } : item
    );
    setExtractedJson({ ...extractedJson, a: updated });
  };

  const confirmPItem = (index: number) => {
    if (!extractedJson) return;
    const updated = extractedJson.p.map((item, i) =>
      i === index ? { ...item, status: 'confirmed' as const } : item
    );
    setExtractedJson({ ...extractedJson, p: updated });
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>読み込み中...</div>;
  }

  if (!visit) {
    return (
      <div style={{ padding: '1rem' }}>
        <p style={{ color: '#cc0000' }}>診療記録が見つかりません</p>
        {onBack && <button type="button" onClick={onBack}>戻る</button>}
      </div>
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

      <h2 style={{ marginTop: 0 }}>診療記録編集</h2>

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>診療情報</h3>
        <InfoRow label="Visit ID" value={visit.visitId} />
        <InfoRow label="牛ID" value={visit.cowId} />
        <InfoRow label="日時" value={visit.datetime} />
        <InfoRow label="ステータス" value={visit.status ?? ''} />
        <InfoRow label="テンプレート" value={visit.templateType ?? ''} />
      </div>

      {visit.transcriptRaw && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>文字起こし</h3>
          <pre
            style={{
              background: '#f5f5f5',
              padding: '0.75rem',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            {visit.transcriptRaw}
          </pre>
        </div>
      )}

      {extractedJson && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>構造化データ編集</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
              体温 (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={extractedJson.vital.temp_c ?? ''}
              onChange={(e) => updateVitalTemp(e.target.value)}
              placeholder="例: 39.5"
              style={{ ...inputStyle, width: '120px' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
              稟告 (S)
            </label>
            <textarea
              rows={3}
              value={extractedJson.s ?? ''}
              onChange={(e) => updateS(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
              所見 (O)
            </label>
            <textarea
              rows={3}
              value={extractedJson.o ?? ''}
              onChange={(e) => updateO(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              診断 (A)
            </label>
            {extractedJson.a.length === 0 && (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>診断なし</p>
            )}
            {extractedJson.a.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.5rem',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderLeft: item.status === 'unconfirmed' ? '3px solid #ff9900' : '3px solid #28a745',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                {item.status === 'confirmed' && <span style={confirmedBadge}>確定</span>}
                {item.status === 'unconfirmed' && <span style={unconfirmedBadge}>未確認</span>}
                {item.confidence != null && (
                  <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                    信頼度: {(item.confidence * 100).toFixed(0)}%
                  </span>
                )}
                {item.master_code && (
                  <span style={{ fontSize: '0.8rem', color: '#555', marginLeft: '0.5rem' }}>
                    [{item.master_code}]
                  </span>
                )}
                {item.status === 'unconfirmed' && (
                  <button
                    type="button"
                    onClick={() => confirmAItem(i)}
                    style={{
                      marginLeft: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '3px',
                    }}
                  >
                    確定
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              処置・投薬 (P)
            </label>
            {extractedJson.p.length === 0 && (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>処置・投薬なし</p>
            )}
            {extractedJson.p.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.5rem',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderLeft: item.status === 'unconfirmed' ? '3px solid #ff9900' : '3px solid #28a745',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                <span
                  style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#fff',
                    background: item.type === 'drug' ? '#6c757d' : '#17a2b8',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '3px',
                  }}
                >
                  {item.type === 'drug' ? '薬剤' : '処置'}
                </span>
                {item.status === 'confirmed' && <span style={confirmedBadge}>確定</span>}
                {item.status === 'unconfirmed' && <span style={unconfirmedBadge}>未確認</span>}
                {item.dosage && (
                  <span style={{ fontSize: '0.85rem', color: '#555', marginLeft: '0.5rem' }}>
                    {item.dosage}
                  </span>
                )}
                {item.confidence != null && (
                  <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                    信頼度: {(item.confidence * 100).toFixed(0)}%
                  </span>
                )}
                {item.master_code && (
                  <span style={{ fontSize: '0.8rem', color: '#555', marginLeft: '0.5rem' }}>
                    [{item.master_code}]
                  </span>
                )}
                {item.status === 'unconfirmed' && (
                  <button
                    type="button"
                    onClick={() => confirmPItem(i)}
                    style={{
                      marginLeft: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '3px',
                    }}
                  >
                    確定
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {visit.soapText && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>SOAPサマリー</h3>
          <pre
            style={{
              background: '#f0f8ff',
              padding: '0.75rem',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            {visit.soapText}
          </pre>
        </div>
      )}

      {visit.kyosaiText && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>家畜共済テキスト</h3>
          <pre
            style={{
              background: '#f0fff0',
              padding: '0.75rem',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            {visit.kyosaiText}
          </pre>
        </div>
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
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !extractedJson}
        style={{
          padding: '0.75rem 2rem',
          background: saving ? '#ccc' : '#0066cc',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '0.4rem', fontSize: '0.9rem' }}>
      <span style={{ fontWeight: 'bold', color: '#555' }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

export default VisitEditor;
