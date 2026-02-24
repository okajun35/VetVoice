/**
 * CowDetailView component
 * Task 6: Display cow details with navigation actions
 * Requirements: 4.1, 4.2, 5.1, 6.2, 6.3
 */
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { CowData } from '../lib/cow-filter';
import { Button } from './ui/Button/Button';
import { Card } from './ui/Card/Card';
import { Spinner } from './ui/Spinner/Spinner';
import styles from './CowDetailView.module.css';

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
      <div className={styles.loadingContainer}>
        <Spinner label="読み込み中..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          ← 戻る
        </Button>
        <h2 className={styles.title}>牛の詳細</h2>
      </div>

      {error && (
        <div
          role="alert"
          className={styles.errorAlert}
        >
          {error}
          <div className={styles.errorActions}>
            <Button
              variant="danger"
              size="sm"
              onClick={fetchCow}
            >
              再取得
            </Button>
          </div>
        </div>
      )}

      {!error && !cow && (
        <div className={styles.notFound}>
          牛が見つかりません
        </div>
      )}

      {cow && (
        <>
          <Card className={styles.detailsCard}>
            <div className={styles.row}>
              <span className={styles.label}>個体識別番号</span>
              <span className={styles.value}>{cow.cowId}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>耳標番号</span>
              <span className={styles.value}>{cow.earTagNo ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>性別</span>
              <span className={styles.value}>{cow.sex ? (SEX_LABELS[cow.sex] ?? cow.sex) : '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>品種</span>
              <span className={styles.value}>{cow.breed ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>生年月日</span>
              <span className={styles.value}>{cow.birthDate ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>産次</span>
              <span className={styles.value}>{cow.parity != null ? String(cow.parity) : '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>最終分娩日</span>
              <span className={styles.value}>{cow.lastCalvingDate ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>名前</span>
              <span className={styles.value}>{cow.name ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>農場名</span>
              <span className={styles.value}>{cow.farm ?? '—'}</span>
            </div>
          </Card>

          <div className={styles.actions}>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => onStartVisit(cow.cowId)}
            >
              診療開始
            </Button>
            <div className={styles.actionRow}>
              <Button
                variant="secondary"
                size="md"
                onClick={onEdit}
                style={{ flex: 1 }}
              >
                編集
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={onGenerateQR}
                style={{ flex: 1 }}
              >
                QRコード生成
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

