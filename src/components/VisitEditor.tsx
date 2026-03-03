/**
 * VisitEditor component
 * Task 22.1: Display and edit Visit data including ExtractedJSON
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { Button } from './ui/Button/Button';
import { Input } from './ui/Input/Input';
import { Card } from './ui/Card/Card';
import { Badge } from './ui/Badge/Badge';
import { Alert } from './ui/Alert/Alert';
import styles from './VisitEditor.module.css';

const client = generateClient<Schema>();

type VisitEditorMode = 'detail' | 'edit';
type DocumentMode = 'auto' | 'manual';

interface VisitEditorProps {
  visitId: string;
  mode?: VisitEditorMode;
  successNotice?: string | null;
  onSuccessNoticeDismiss?: () => void;
  onBack?: () => void;
  onSaved?: () => void;
  onEditRequested?: (visitId: string) => void;
}

interface ExtractedJSON {
  vital: {
    temp_c: number | null;
    heart_rate_bpm?: number | null;
    resp_rate_bpm?: number | null;
  };
  s: string | null;
  o: string | null;
  diagnostic_pattern?: 'metabolic' | 'infectious' | 'reproductive' | 'unknown';
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
  extractorModelId?: string | null;
  soapModelId?: string | null;
  kyosaiModelId?: string | null;
  audioKey?: string | null;
  transcriptRaw?: string | null;
  extractedJson?: unknown;
  soapText?: string | null;
  kyosaiText?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

interface FieldDiffRow {
  field: string;
  original: string;
  edited: string;
}

const EXTRACTED_JSON_FALLBACK_MESSAGE =
  'Structured data is invalid. Loaded an empty editable template. Fill required fields and save.';

function createEmptyExtractedJson(): ExtractedJSON {
  return {
    vital: {
      temp_c: null,
      heart_rate_bpm: null,
      resp_rate_bpm: null,
    },
    s: null,
    o: null,
    a: [],
    p: [],
  };
}

function decodeExtractedJsonPayload(value: unknown): unknown {
  let current: unknown = value;
  for (let depth = 0; depth < 2; depth++) {
    if (typeof current !== 'string') {
      return current;
    }
    const trimmed = current.trim();
    if (!trimmed) return null;
    try {
      current = JSON.parse(trimmed);
    } catch {
      return current;
    }
  }
  return current;
}

function normalizeTextField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAssessmentEntries(value: unknown): ExtractedJSON['a'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
    .map((entry) => {
      const status: 'confirmed' | 'unconfirmed' | undefined =
        entry.status === 'confirmed' || entry.status === 'unconfirmed'
          ? entry.status
          : undefined;
      return {
        name: typeof entry.name === 'string' ? entry.name : '',
        canonical_name:
          typeof entry.canonical_name === 'string' ? entry.canonical_name : undefined,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : undefined,
        master_code: typeof entry.master_code === 'string' ? entry.master_code : undefined,
        status,
      };
    })
    .filter((entry) => entry.name.trim().length > 0);
}

function normalizePlanEntries(value: unknown): ExtractedJSON['p'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
    .map((entry) => {
      const planType: 'procedure' | 'drug' = entry.type === 'drug' ? 'drug' : 'procedure';
      const status: 'confirmed' | 'unconfirmed' | undefined =
        entry.status === 'confirmed' || entry.status === 'unconfirmed'
          ? entry.status
          : undefined;
      return {
        name: typeof entry.name === 'string' ? entry.name : '',
        canonical_name:
          typeof entry.canonical_name === 'string' ? entry.canonical_name : undefined,
        type: planType,
        dosage: typeof entry.dosage === 'string' ? entry.dosage : undefined,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : undefined,
        master_code: typeof entry.master_code === 'string' ? entry.master_code : undefined,
        status,
      };
    })
    .filter((entry) => entry.name.trim().length > 0);
}

function normalizeExtractedJson(raw: unknown): ExtractedJSON | null {
  if (!isPlainObject(raw)) return null;

  const vital = isPlainObject(raw.vital) ? raw.vital : {};
  const toNullableNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const temp = toNullableNumber(vital.temp_c);
  const heartRate = toNullableNumber(vital.heart_rate_bpm);
  const respRate = toNullableNumber(vital.resp_rate_bpm);
  const diagnosticPattern =
    raw.diagnostic_pattern === 'metabolic' ||
    raw.diagnostic_pattern === 'infectious' ||
    raw.diagnostic_pattern === 'reproductive' ||
    raw.diagnostic_pattern === 'unknown'
      ? raw.diagnostic_pattern
      : undefined;

  return {
    vital: {
      temp_c: temp,
      heart_rate_bpm: heartRate,
      resp_rate_bpm: respRate,
    },
    s: normalizeTextField(raw.s),
    o: normalizeTextField(raw.o),
    ...(diagnosticPattern != null ? { diagnostic_pattern: diagnosticPattern } : {}),
    a: normalizeAssessmentEntries(raw.a),
    p: normalizePlanEntries(raw.p),
  };
}

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildJsonPatch(
  before: unknown,
  after: unknown,
  path = ''
): JsonPatchOperation[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeText = JSON.stringify(before);
    const afterText = JSON.stringify(after);
    return beforeText === afterText ? [] : [{ op: 'replace', path: path || '/', value: after }];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const operations: JsonPatchOperation[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const childPath = `${path}/${escapeJsonPointerToken(key)}`;
      if (!(key in after)) {
        operations.push({ op: 'remove', path: childPath });
        continue;
      }
      if (!(key in before)) {
        operations.push({ op: 'add', path: childPath, value: after[key] });
        continue;
      }
      operations.push(...buildJsonPatch(before[key], after[key], childPath));
    }
    return operations;
  }

  return [{ op: 'replace', path: path || '/', value: after }];
}

function flattenForDiff(value: unknown, path = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[path || '(root)'] = [];
      return out;
    }
    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index}]` : `[${index}]`;
      flattenForDiff(item, nextPath, out);
    });
    return out;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      out[path || '(root)'] = {};
      return out;
    }
    keys.forEach((key) => {
      const nextPath = path ? `${path}.${key}` : key;
      flattenForDiff(value[key], nextPath, out);
    });
    return out;
  }

  out[path || '(root)'] = value;
  return out;
}

function toDisplayValue(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function buildFieldLevelDiffRows(before: unknown, after: unknown): FieldDiffRow[] {
  const beforeFlat = flattenForDiff(before);
  const afterFlat = flattenForDiff(after);
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();
  return keys
    .filter((key) => JSON.stringify(beforeFlat[key]) !== JSON.stringify(afterFlat[key]))
    .map((key) => ({
      field: key,
      original: toDisplayValue(beforeFlat[key]),
      edited: toDisplayValue(afterFlat[key]),
    }));
}

function normalizeDocumentText(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value;
}

function toSerializableJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === 'number' && !Number.isFinite(item)) {
        return null;
      }
      return item;
    })
  ) as T;
}

function toAwsJsonString(value: unknown): string {
  return JSON.stringify(toSerializableJson(value));
}

async function resolveEditorId(): Promise<string> {
  try {
    const user = await getCurrentUser();
    return user.userId || user.username || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function VisitEditor({
  visitId,
  mode = 'edit',
  successNotice = null,
  onSuccessNoticeDismiss,
  onBack,
  onSaved,
  onEditRequested,
}: VisitEditorProps) {
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [extractedJson, setExtractedJson] = useState<ExtractedJSON | null>(null);
  const [draftExtractedJson, setDraftExtractedJson] = useState<ExtractedJSON | null>(null);
  const [editStartedAt, setEditStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUrlExpiresAt, setAudioUrlExpiresAt] = useState<Date | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictDetected, setConflictDetected] = useState(false);
  const [soapMode, setSoapMode] = useState<DocumentMode>('auto');
  const [kyosaiMode, setKyosaiMode] = useState<DocumentMode>('auto');
  const [autoSoapText, setAutoSoapText] = useState('');
  const [autoKyosaiText, setAutoKyosaiText] = useState('');
  const [manualSoapText, setManualSoapText] = useState('');
  const [manualKyosaiText, setManualKyosaiText] = useState('');
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const fetchVisit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflictDetected(false);
    try {
      const collectedErrors: string[] = [];
      const { data, errors } = await client.models.Visit.get({ visitId });
      if (errors && errors.length > 0) {
        collectedErrors.push(...errors.map((e) => e.message));
      }

      let resolvedVisit = data as VisitData | null;
      if (!resolvedVisit) {
        const { data: listData, errors: listErrors } = await client.models.Visit.list({
          filter: { visitId: { eq: visitId } },
          limit: 1,
        });
        if (listErrors && listErrors.length > 0) {
          collectedErrors.push(...listErrors.map((e) => e.message));
        }
        resolvedVisit = ((listData ?? [])[0] as VisitData | undefined) ?? null;
      }

      setVisit(resolvedVisit);
      if (!resolvedVisit) {
        const details = collectedErrors.length > 0 ? `\n${collectedErrors.join('\n')}` : '';
        setError(`Visit record not found (visitId: ${visitId}).${details}`);
        return;
      }

      if (collectedErrors.length > 0) {
        setError(collectedErrors.join('\n'));
      }

      const nextAutoSoap = normalizeDocumentText(resolvedVisit.soapText);
      const nextAutoKyosai = normalizeDocumentText(resolvedVisit.kyosaiText);
      setAutoSoapText(nextAutoSoap);
      setAutoKyosaiText(nextAutoKyosai);
      setManualSoapText(nextAutoSoap);
      setManualKyosaiText(nextAutoKyosai);
      setSoapMode('auto');
      setKyosaiMode('auto');

      if (resolvedVisit.extractedJson) {
        try {
          const parsed = decodeExtractedJsonPayload(resolvedVisit.extractedJson);
          const extracted = normalizeExtractedJson(parsed);
          if (!extracted) {
            const fallback = createEmptyExtractedJson();
            setError(EXTRACTED_JSON_FALLBACK_MESSAGE);
            setExtractedJson(fallback);
            setDraftExtractedJson(fallback);
            setEditStartedAt(Date.now());
          } else {
            setExtractedJson(extracted);
            setDraftExtractedJson(extracted);
            setEditStartedAt(Date.now());
          }
        } catch {
          const fallback = createEmptyExtractedJson();
          setError(EXTRACTED_JSON_FALLBACK_MESSAGE);
          setExtractedJson(fallback);
          setDraftExtractedJson(fallback);
          setEditStartedAt(Date.now());
        }
      } else {
        const fallback = createEmptyExtractedJson();
        setExtractedJson(fallback);
        setDraftExtractedJson(fallback);
        setEditStartedAt(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visit data.');
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void fetchVisit();
  }, [fetchVisit]);

  useEffect(() => {
    if (mode !== 'detail') return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      // ignore environments where window.scrollTo is not implemented
    }
    titleRef.current?.focus();
  }, [mode, visitId]);

  const resolveAudioUrl = useCallback(async (): Promise<string> => {
    if (!visit?.audioKey) {
      throw new Error('Audio key is missing.');
    }
    if (audioUrl && audioUrlExpiresAt && audioUrlExpiresAt.getTime() > Date.now() + 30_000) {
      return audioUrl;
    }

    const signed = await getUrl({
      path: visit.audioKey,
      options: {
        validateObjectExistence: true,
        expiresIn: 3600,
      },
    });
    const nextAudioUrl = signed.url.toString();
    setAudioUrl(nextAudioUrl);
    setAudioUrlExpiresAt(signed.expiresAt ?? new Date(Date.now() + 3600 * 1000));
    return nextAudioUrl;
  }, [audioUrl, audioUrlExpiresAt, visit?.audioKey]);

  useEffect(() => {
    if (!visit?.audioKey) return;
    setAudioError(null);
    void resolveAudioUrl().catch((err) => {
      setAudioError(err instanceof Error ? err.message : 'Failed to load audio.');
    });
  }, [visit?.audioKey, resolveAudioUrl]);

  const handleRegenerateDocuments = async () => {
    if (!visit || !extractedJson) return;

    const manualModeActive = soapMode === 'manual' || kyosaiMode === 'manual';
    if (manualModeActive) {
      const approved = window.confirm(
        'Regeneration can overwrite manual SOAP/Kyosai edits. Continue?'
      );
      if (!approved) return;
    }

    setRegenerating(true);
    setError(null);
    try {
      const runPipeline = client.queries?.runPipeline;
      if (!runPipeline) {
        setError('Pipeline query is not available in this environment.');
        return;
      }

      const { data, errors } = await runPipeline({
        entryPoint: 'JSON_INPUT',
        cowId: visit.cowId,
        visitId: visit.visitId,
        extractedJson: JSON.stringify(extractedJson),
        templateType: visit.templateType ?? undefined,
      });

      if (errors && errors.length > 0) {
        setError(`Document regeneration failed:\n${errors.map((e) => e.message).join('\n')}`);
        return;
      }

      const nextSoap = normalizeDocumentText(data?.soapText ?? null);
      const nextKyosai = normalizeDocumentText(data?.kyosaiText ?? null);

      setAutoSoapText(nextSoap);
      setAutoKyosaiText(nextKyosai);
      if (soapMode === 'manual') {
        setManualSoapText(nextSoap);
      }
      if (kyosaiMode === 'manual') {
        setManualKyosaiText(nextKyosai);
      }

      setVisit((prev) =>
        prev
          ? {
              ...prev,
              soapText: nextSoap,
              kyosaiText: nextKyosai,
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate documents.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!visit || !extractedJson || !draftExtractedJson) return;
    setSaving(true);
    setError(null);
    setConflictDetected(false);

    try {
      const latestResult = await client.models.Visit.get({ visitId });
      const latestVisit = latestResult.data as VisitData | null;
      const latestErrors = latestResult.errors ?? [];

      if (latestErrors.length > 0) {
        setError(`Could not verify latest visit version:\n${latestErrors.map((e) => e.message).join('\n')}`);
        return;
      }

      if (!latestVisit) {
        setError(`Visit record not found during save (visitId: ${visitId}).`);
        return;
      }

      if (
        latestVisit.updatedAt &&
        visit.updatedAt &&
        latestVisit.updatedAt !== visit.updatedAt
      ) {
        setConflictDetected(true);
        setError('This record has newer changes. Reload before saving.');
        return;
      }

      const resolvedSoapText =
        soapMode === 'manual' ? manualSoapText.trim() : autoSoapText.trim();
      const resolvedKyosaiText =
        kyosaiMode === 'manual' ? manualKyosaiText.trim() : autoKyosaiText.trim();

      const editedAt = new Date().toISOString();
      const editorId = await resolveEditorId();
      const duration =
        editStartedAt == null ? null : Math.max(0, Math.round((Date.now() - editStartedAt) / 1000));
      const diffJsonPatch = buildJsonPatch(draftExtractedJson, extractedJson);
      const serializedDraftExtractedJson = toSerializableJson(draftExtractedJson);
      const serializedExtractedJson = toSerializableJson(extractedJson);
      const serializedDiffJsonPatch = toSerializableJson(diffJsonPatch);

      const { data: updatedVisit, errors: visitErrors } = await client.models.Visit.update({
        visitId,
        extractedJson: JSON.stringify(serializedExtractedJson),
        soapText: resolvedSoapText.length > 0 ? resolvedSoapText : null,
        kyosaiText: resolvedKyosaiText.length > 0 ? resolvedKyosaiText : null,
      });

      if (visitErrors && visitErrors.length > 0) {
        setError(visitErrors.map((e) => e.message).join('\n'));
        return;
      }

      const { errors: editErrors } = await client.models.VisitEdit.create({
        editId: crypto.randomUUID(),
        visitId: visit.visitId,
        caseId: visit.visitId,
        cowId: visit.cowId,
        modelId: visit.extractorModelId ?? 'unknown',
        editorId,
        editedAt,
        editDurationSec: duration,
        llmDraftJson: toAwsJsonString(serializedDraftExtractedJson),
        humanCorrectedJson: toAwsJsonString(serializedExtractedJson),
        diffJsonPatch: toAwsJsonString(serializedDiffJsonPatch),
      });

      if (editErrors && editErrors.length > 0) {
        setError(
          `Visit saved, but edit history save failed.\n${editErrors.map((e) => e.message).join('\n')}`
        );
        return;
      }

      setDraftExtractedJson(serializedExtractedJson);
      setEditStartedAt(Date.now());
      setVisit((prev) => {
        const merged = updatedVisit as VisitData | null;
        if (merged) return merged;
        if (!prev) return prev;
        return {
          ...prev,
          extractedJson: JSON.stringify(serializedExtractedJson),
          soapText: resolvedSoapText.length > 0 ? resolvedSoapText : null,
          kyosaiText: resolvedKyosaiText.length > 0 ? resolvedKyosaiText : null,
        };
      });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const parseNullableNumber = (value: string): number | null => {
    if (value.trim() === '') return null;
    const num = parseFloat(value);
    return Number.isNaN(num) ? null : num;
  };

  const updateVitalField = (
    field: 'temp_c' | 'heart_rate_bpm' | 'resp_rate_bpm',
    value: string
  ) => {
    if (!extractedJson) return;
    setExtractedJson({
      ...extractedJson,
      vital: {
        ...extractedJson.vital,
        [field]: parseNullableNumber(value),
      },
    });
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

  const diffRows = useMemo(() => {
    if (!draftExtractedJson || !extractedJson) return [];
    return buildFieldLevelDiffRows(draftExtractedJson, extractedJson);
  }, [draftExtractedJson, extractedJson]);

  if (loading) {
    return <div className={styles.loading}>Loading visit...</div>;
  }

  if (!visit) {
    return (
      <div className={styles.notFound}>
        <p className={styles.notFoundText}>Visit record not found.</p>
        {error && <p className={styles.error}>{error}</p>}
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Back to Visit List
          </Button>
        )}
      </div>
    );
  }

  const displaySoapText = soapMode === 'manual' ? manualSoapText : autoSoapText;
  const displayKyosaiText = kyosaiMode === 'manual' ? manualKyosaiText : autoKyosaiText;

  return (
    <div className={styles.container}>
      {onBack && (
        <div className={styles.backButton}>
          <Button variant="secondary" onClick={onBack}>
            Back to Visit List
          </Button>
        </div>
      )}

      <h2 ref={titleRef} tabIndex={-1} className={styles.title}>
        {mode === 'detail' ? 'Visit Detail' : 'Visit Edit'}
      </h2>

      {successNotice && (
        <Alert variant="success" className={styles.successNotice}>
          <div className={styles.successNoticeContent}>
            <span>{successNotice}</span>
            {onSuccessNoticeDismiss && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSuccessNoticeDismiss}
              >
                Dismiss
              </Button>
            )}
          </div>
        </Alert>
      )}

      <Card className={styles.section}>
        <h3 className={styles.sectionTitle}>Visit Information</h3>
        <InfoRow label="Visit ID" value={visit.visitId} />
        <InfoRow label="Cow ID" value={visit.cowId} />
        <InfoRow label="Datetime" value={visit.datetime} />
        <InfoRow label="Status" value={visit.status ?? ''} />
        <InfoRow label="Audio Key" value={visit.audioKey ?? ''} />
        <InfoRow label="Template" value={visit.templateType ?? ''} />
        <InfoRow label="Created At" value={visit.createdAt ?? ''} />
        <InfoRow label="Updated At" value={visit.updatedAt ?? ''} />
      </Card>

      {visit.audioKey && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>Audio Recording</h3>
          <div className={styles.audioSection}>
            <div className={styles.audioMeta}>audioKey: {visit.audioKey}</div>
            {audioError && <div className={styles.audioMeta}>{audioError}</div>}
            <audio controls src={audioUrl ?? undefined} className={styles.audioPlayer} />
          </div>
        </Card>
      )}

      {visit.transcriptRaw && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>Transcript</h3>
          <pre className={styles.transcript}>{visit.transcriptRaw}</pre>
        </Card>
      )}

      {mode === 'detail' && extractedJson && (
        <Card className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Structured Data</h3>
            {onEditRequested && (
              <Button variant="primary" size="sm" onClick={() => onEditRequested(visit.visitId)}>
                Edit Structured Data
              </Button>
            )}
          </div>
          <pre className={styles.transcript}>{JSON.stringify(extractedJson, null, 2)}</pre>
        </Card>
      )}

      {mode === 'edit' && extractedJson && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>Structured Data Editor</h3>

          <div className={styles.formField}>
            <div className={styles.vitalGrid}>
              <Input
                type="number"
                label="Body Temperature (°C)"
                value={extractedJson.vital.temp_c?.toString() ?? ''}
                onChange={(e) => updateVitalField('temp_c', e.target.value)}
                placeholder="e.g. 39.5"
                className={styles.vitalInput}
              />
              <Input
                type="number"
                label="Heart Rate (bpm)"
                value={extractedJson.vital.heart_rate_bpm?.toString() ?? ''}
                onChange={(e) => updateVitalField('heart_rate_bpm', e.target.value)}
                placeholder="e.g. 72"
                className={styles.vitalInput}
              />
              <Input
                type="number"
                label="Respiratory Rate (bpm)"
                value={extractedJson.vital.resp_rate_bpm?.toString() ?? ''}
                onChange={(e) => updateVitalField('resp_rate_bpm', e.target.value)}
                placeholder="e.g. 28"
                className={styles.vitalInput}
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Subjective (S)</label>
            <textarea
              rows={3}
              value={extractedJson.s ?? ''}
              onChange={(e) => updateS(e.target.value)}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Objective (O)</label>
            <textarea
              rows={3}
              value={extractedJson.o ?? ''}
              onChange={(e) => updateO(e.target.value)}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Assessment (A)</label>
            {extractedJson.a.length === 0 && <p className={styles.emptyState}>No assessment items.</p>}
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
                      Confirmed
                    </Badge>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Badge variant="warning" size="sm">
                      Unconfirmed
                    </Badge>
                  )}
                  {item.confidence != null && (
                    <span className={styles.itemMeta}>
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {item.master_code && <span className={styles.itemMeta}>[{item.master_code}]</span>}
                  {item.status === 'unconfirmed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => confirmAItem(i)}
                      className={styles.confirmButton}
                    >
                      Confirm
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Plan (P)</label>
            {extractedJson.p.length === 0 && <p className={styles.emptyState}>No plan items.</p>}
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
                    {item.type === 'drug' ? 'Drug' : 'Procedure'}
                  </Badge>
                  {item.status === 'confirmed' && (
                    <Badge variant="success" size="sm">
                      Confirmed
                    </Badge>
                  )}
                  {item.status === 'unconfirmed' && (
                    <Badge variant="warning" size="sm">
                      Unconfirmed
                    </Badge>
                  )}
                  {item.dosage && <span className={styles.itemMeta}>{item.dosage}</span>}
                  {item.confidence != null && (
                    <span className={styles.itemMeta}>
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {item.master_code && <span className={styles.itemMeta}>[{item.master_code}]</span>}
                  {item.status === 'unconfirmed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => confirmPItem(i)}
                      className={styles.confirmButton}
                    >
                      Confirm
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <details className={styles.advancedPanel}>
            <summary className={styles.advancedSummary}>Advanced: Raw JSON</summary>
            <pre className={styles.transcript}>{JSON.stringify(extractedJson, null, 2)}</pre>
          </details>
        </Card>
      )}

      {(mode === 'detail' || mode === 'edit') && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>Generated Documents</h3>

          <div className={styles.documentGrid}>
            <div>
              <div className={styles.documentHeader}>
                <h4 className={styles.documentTitle}>SOAP</h4>
                {mode === 'edit' && (
                  <div className={styles.modeToggle}>
                    <Button
                      type="button"
                      size="sm"
                      variant={soapMode === 'auto' ? 'primary' : 'secondary'}
                      onClick={() => setSoapMode('auto')}
                    >
                      Auto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={soapMode === 'manual' ? 'primary' : 'secondary'}
                      onClick={() => {
                        if (soapMode !== 'manual') {
                          setManualSoapText(autoSoapText);
                        }
                        setSoapMode('manual');
                      }}
                    >
                      Manual
                    </Button>
                  </div>
                )}
              </div>

              {mode === 'edit' && soapMode === 'manual' ? (
                <textarea
                  rows={8}
                  value={manualSoapText}
                  onChange={(e) => setManualSoapText(e.target.value)}
                  className={styles.textarea}
                />
              ) : (
                <pre className={styles.transcript}>{displaySoapText || 'No SOAP text available.'}</pre>
              )}
            </div>

            <div>
              <div className={styles.documentHeader}>
                <h4 className={styles.documentTitle}>Kyosai</h4>
                {mode === 'edit' && (
                  <div className={styles.modeToggle}>
                    <Button
                      type="button"
                      size="sm"
                      variant={kyosaiMode === 'auto' ? 'primary' : 'secondary'}
                      onClick={() => setKyosaiMode('auto')}
                    >
                      Auto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={kyosaiMode === 'manual' ? 'primary' : 'secondary'}
                      onClick={() => {
                        if (kyosaiMode !== 'manual') {
                          setManualKyosaiText(autoKyosaiText);
                        }
                        setKyosaiMode('manual');
                      }}
                    >
                      Manual
                    </Button>
                  </div>
                )}
              </div>

              {mode === 'edit' && kyosaiMode === 'manual' ? (
                <textarea
                  rows={8}
                  value={manualKyosaiText}
                  onChange={(e) => setManualKyosaiText(e.target.value)}
                  className={styles.textarea}
                />
              ) : (
                <pre className={styles.transcript}>{displayKyosaiText || 'No Kyosai text available.'}</pre>
              )}
            </div>
          </div>

          {mode === 'edit' && (
            <div className={styles.documentActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRegenerateDocuments}
                loading={regenerating}
                disabled={regenerating}
              >
                Regenerate from Structured Data
              </Button>
            </div>
          )}
        </Card>
      )}

      {mode === 'edit' && extractedJson && draftExtractedJson && (
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>Change Review</h3>

          {diffRows.length === 0 ? (
            <p className={styles.emptyState}>No field-level changes yet.</p>
          ) : (
            <div className={styles.diffTableWrap}>
              <table className={styles.diffTable}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Original</th>
                    <th>Edited</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row) => (
                    <tr key={row.field}>
                      <td>{row.field}</td>
                      <td>{row.original}</td>
                      <td>{row.edited}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.compareColumns}>
            <div>
              <h4 className={styles.documentTitle}>Original (LLM Draft)</h4>
              <pre className={styles.transcript}>{JSON.stringify(draftExtractedJson, null, 2)}</pre>
            </div>
            <div>
              <h4 className={styles.documentTitle}>Edited (Current)</h4>
              <pre className={styles.transcript}>{JSON.stringify(extractedJson, null, 2)}</pre>
            </div>
          </div>
        </Card>
      )}

      {conflictDetected && (
        <div className={styles.conflictBox} role="alert">
          <p>This record has newer changes. Please reload before saving.</p>
          <Button type="button" variant="secondary" onClick={() => void fetchVisit()}>
            Reload Latest
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}

      {mode === 'edit' && (
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={saving || !extractedJson}
          loading={saving}
          fullWidth
          className={styles.saveButton}
        >
          Save Changes
        </Button>
      )}
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
