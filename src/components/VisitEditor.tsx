/**
 * VisitEditor component
 * Task 22.1: Display and edit Visit data including ExtractedJSON
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Button } from './ui/Button/Button';
import { Input } from './ui/Input/Input';
import { Card } from './ui/Card/Card';
import { Badge } from './ui/Badge/Badge';
import styles from './VisitEditor.module.css';

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
    canonical_name?: string;
    confidence?: number;
    master_code?: string;
    status?: 'confirmed' | 'unconfirmed';
  }>;
  p: Array<{
    name: string;
    canonical_name?: string;
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
    return <div className={styles.loading}>読み込み中...</div>;
  }

  if (!visit) {
    return (
      <div className={styles.notFound}>
        <p className={styles.notFoundText}>診療記録が見つかりません</p>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            戻る
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {onBack && (
        <div className={styles.backButton}>
          <Button variant="ghost" onClick={onBack}>
            ← 戻る
          </Button>
        </div>
      )}

      <h2 className={styles.title}>診療記録編集</h2>

      <Card className={styles.section}>
        <h3 className={styles.sectionTitle}>診療情報</h3>
        <InfoRow label="Visit ID" value={visit.visitId} />
        <InfoRow label="牛ID" value={visit.cowId} />
        <InfoRow label="日時" value={visit.datetime} />
        <InfoRow label="ステータス" value={visit.status ?? ''} />
        <InfoRow label="テンプレート" value={visit.templateType ?? ''} />
      </Card>

      {visit.transcriptRaw && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>文字起こし</h3>
          <pre className={styles.transcript}>{visit.transcriptRaw}</pre>
        </Card>
      )}

      {extractedJson && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>構造化データ編集</h3>

          <div className={styles.formField}>
            <Input
              type="number"
              label="体温 (°C)"
              value={extractedJson.vital.temp_c?.toString() ?? ''}
              onChange={(e) => updateVitalTemp(e.target.value)}
              placeholder="例: 39.5"
              className={styles.tempInput}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>稟告 (S)</label>
            <textarea
              rows={3}
              value={extractedJson.s ?? ''}
              onChange={(e) => updateS(e.target.value)}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>所見 (O)</label>
            <textarea
              rows={3}
              value={extractedJson.o ?? ''}
              onChange={(e) => updateO(e.target.value)}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>診断 (A)</label>
            {extractedJson.a.length === 0 && (
              <p className={styles.emptyState}>診断なし</p>
            )}
            <div className={styles.itemList}>
              {extractedJson.a.map((item, i) => (
                <div
                  key={i}
                  className={`${styles.item} ${
                    item.status === 'unconfirmed'
                      ? styles['item--unconfirmed']
                      : styles['item--confirmed']
                  }`}
                >
                  <span className={styles.itemName}>{item.canonical_name ?? item.name}</span>
                  {item.status === 'confirmed' && (
                    <Badge variant="success" size="sm">
                      確定
                    </Badge>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Badge variant="warning" size="sm">
                      未確認
                    </Badge>
                  )}
                  {item.confidence != null && (
                    <span className={styles.itemMeta}>
                      信頼度: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {item.master_code && (
                    <span className={styles.itemMeta}>[{item.master_code}]</span>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => confirmAItem(i)}
                      className={styles.confirmButton}
                    >
                      確定
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>処置・投薬 (P)</label>
            {extractedJson.p.length === 0 && (
              <p className={styles.emptyState}>処置・投薬なし</p>
            )}
            <div className={styles.itemList}>
              {extractedJson.p.map((item, i) => (
                <div
                  key={i}
                  className={`${styles.item} ${
                    item.status === 'unconfirmed'
                      ? styles['item--unconfirmed']
                      : styles['item--confirmed']
                  }`}
                >
                  <span className={styles.itemName}>{item.canonical_name ?? item.name}</span>
                  <Badge variant={item.type === 'drug' ? 'neutral' : 'info'} size="sm">
                    {item.type === 'drug' ? '薬剤' : '処置'}
                  </Badge>
                  {item.status === 'confirmed' && (
                    <Badge variant="success" size="sm">
                      確定
                    </Badge>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Badge variant="warning" size="sm">
                      未確認
                    </Badge>
                  )}
                  {item.dosage && <span className={styles.itemMeta}>{item.dosage}</span>}
                  {item.confidence != null && (
                    <span className={styles.itemMeta}>
                      信頼度: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {item.master_code && (
                    <span className={styles.itemMeta}>[{item.master_code}]</span>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => confirmPItem(i)}
                      className={styles.confirmButton}
                    >
                      確定
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {visit.soapText && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>SOAPサマリー</h3>
          <pre className={styles.transcript}>{visit.soapText}</pre>
        </Card>
      )}

      {visit.kyosaiText && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>家畜共済テキスト</h3>
          <pre className={styles.transcript}>{visit.kyosaiText}</pre>
        </Card>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={handleSave}
        disabled={saving || !extractedJson}
        loading={saving}
        fullWidth
        className={styles.saveButton}
      >
        保存
      </Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

export default VisitEditor;
