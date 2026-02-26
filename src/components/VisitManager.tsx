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
import { Button } from './ui/Button/Button';
import { Badge } from './ui/Badge/Badge';
import { Card } from './ui/Card/Card';
import { Alert } from './ui/Alert/Alert';
import { Spinner } from './ui/Spinner/Spinner';
import styles from './VisitManager.module.css';

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
    return <Spinner label="読み込み中..." />;
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
    <div className={styles.wrapper}>
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className={styles.backButton}
        >
          ← 戻る
        </Button>
      )}

      {error && (
        <Alert variant="error" className={styles.errorMargin}>
          {error}
        </Alert>
      )}

      {cow && (
        <Card className={styles.cowCard}>
          <h2 className={styles.sectionTitle}>牛情報</h2>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>個体識別番号:</span>
            <span>{cow.cowId}</span>
          </div>
          {cow.earTagNo && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>耳標番号:</span>
              <span>{cow.earTagNo}</span>
            </div>
          )}
          {cow.sex && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>性別:</span>
              <span>{SEX_LABELS[cow.sex] ?? cow.sex}</span>
            </div>
          )}
          {cow.breed && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>品種:</span>
              <span>{cow.breed}</span>
            </div>
          )}
          {cow.birthDate && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>生年月日:</span>
              <span>{cow.birthDate}</span>
            </div>
          )}
          {cow.parity != null && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>産次:</span>
              <span>{cow.parity}</span>
            </div>
          )}
          {cow.lastCalvingDate && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>最終分娩日:</span>
              <span>{cow.lastCalvingDate}</span>
            </div>
          )}
          {cow.name && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>名前:</span>
              <span>{cow.name}</span>
            </div>
          )}
          {cow.farm && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>農場:</span>
              <span>{cow.farm}</span>
            </div>
          )}
        </Card>
      )}

      {view === 'list' && (
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>診療履歴</h2>
            <Button
              type="button"
              variant="primary"
              onClick={() => setView('new_visit')}
            >
              新規診療を開始
            </Button>
          </div>

          {visits.length === 0 ? (
            <p className={styles.emptyText}>診療履歴がありません</p>
          ) : (
            <div>
              {visits.map((visit) => (
                <button
                  key={visit.visitId}
                  type="button"
                  onClick={() => handleSelectVisit(visit.visitId)}
                  className={styles.visitItem}
                >
                  <div className={styles.visitItemDate}>
                    {new Date(visit.datetime).toLocaleString('ja-JP')}
                  </div>
                  <div className={styles.visitItemMeta}>
                    {visit.templateType && <span>テンプレート: {visit.templateType}</span>}
                    {visit.status && (
                      <Badge variant={visit.status === 'COMPLETED' ? 'success' : 'warning'} size="sm">
                        {STATUS_LABELS[visit.status] ?? visit.status}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'new_visit' && (
        <Card className={styles.newVisitCard}>
          <div className={styles.newVisitHeader}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView('list')}
            >
              ← 戻る
            </Button>
            <h2 className={styles.sectionTitle}>新規診療</h2>
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
        </Card>
      )}
    </div>
  );
}

export default VisitManager;
