/**
 * PipelineEntryForm - shared pipeline execution UI component
 *
 * Tasks 1.1-1.8: Extracted from DevEntryPoints.tsx
 * Supports dev mode (all 4 tabs + editable cowId) and
 * production mode (PRODUCTION + TEXT_INPUT tabs, cowId from props).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { VoiceRecorder } from './VoiceRecorder';
import {
  TABS_BY_MODE,
  TAB_LABELS,
  type FormMode,
  type TabMode,
} from './pipelineEntryForm.constants';
import styles from './PipelineEntryForm.module.css';

const client = generateClient<Schema>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineResult {
  visitId: string;
  cowId: string;
  status?: 'IN_PROGRESS' | 'COMPLETED';
  audioKey?: string | null;
  transcribeJobName?: string | null;
  transcriptRaw?: string | null;
  transcriptExpanded?: string | null;
  extractedJson?: unknown;
  soapText?: string | null;
  kyosaiText?: string | null;
  templateType?: string | null;
  warnings?: (string | null)[] | null;
}

interface AudioPreview {
  url: string;
  source: 'local' | 's3';
  label: string;
}

export type { FormMode, TabMode } from './pipelineEntryForm.constants';

export interface PipelineEntryFormProps {
  cowId: string;
  mode: FormMode;
  showCowIdInput?: boolean;
  onPipelineComplete?: (result: PipelineResult) => void;
  onError?: (errorMessage: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTRACTOR_MODEL_OPTIONS = [
  { value: '', label: '(default) Claude Haiku 4.5' },
  { value: 'us.amazon.nova-premier-v1:0', label: 'Amazon Nova Premier (US Profile)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (US Profile)' },
  { value: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (US Profile)' },
  { value: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (US Profile)' },
  { value: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (US Profile)' },
  { value: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku (US Profile)' },
];

const SOAP_MODEL_OPTIONS = [
  { value: '', label: '(default) Amazon Nova Lite' },
  { value: 'us.amazon.nova-premier-v1:0', label: 'Amazon Nova Premier (US Profile)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (US Profile)' },
  { value: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (US Profile)' },
  { value: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (US Profile)' },
  { value: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (US Profile)' },
  { value: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku (US Profile)' },
];

const KYOSAI_MODEL_OPTIONS = [
  { value: '', label: '(default) Amazon Nova Lite' },
  { value: 'us.amazon.nova-premier-v1:0', label: 'Amazon Nova Premier (US Profile)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (US Profile)' },
  { value: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (US Profile)' },
  { value: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (US Profile)' },
  { value: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet (US Profile)' },
  { value: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku (US Profile)' },
];

const AUDIO_PIPELINE_POLL_INTERVAL_MS = 5000;
const AUDIO_PIPELINE_MAX_POLLS = 72;
const TRANSCRIPTION_WAITING_LABEL = 'Waiting for transcription';
const TRANSCRIPTION_STARTING_LABEL = 'Starting transcription job';
const AUDIO_UPLOADING_LABEL = 'Uploading';

interface ExtractedJsonDisplay {
  text: string;
  isRawFallback: boolean;
}

function formatExtractedJsonForDisplay(value: unknown): ExtractedJsonDisplay {
  let current: unknown = value;

  // Handle both object payloads and double-encoded JSON strings.
  for (let depth = 0; depth < 2; depth++) {
    if (typeof current !== 'string') break;
    const trimmed = current.trim();
    if (!trimmed) return { text: '', isRawFallback: true };
    try {
      current = JSON.parse(trimmed);
    } catch {
      return { text: String(current), isRawFallback: true };
    }
  }

  try {
    return { text: JSON.stringify(current, null, 2), isRawFallback: false };
  } catch {
    return { text: String(current), isRawFallback: true };
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Inline style constants removed - replaced by CSS Modules in PipelineEntryForm.module.css

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineEntryForm({
  cowId,
  mode,
  showCowIdInput = mode === 'dev',
  onPipelineComplete,
  onError,
}: PipelineEntryFormProps) {
  const tabs = TABS_BY_MODE[mode];

  const [activeTab, setActiveTab] = useState<TabMode>(tabs[0]);
  const [effectiveCowId, setEffectiveCowId] = useState(cowId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const [transcriptText, setTranscriptText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<AudioPreview | null>(null);
  const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [extractorModelId, setExtractorModelId] = useState('');
  const [soapModelId, setSoapModelId] = useState('');
  const [kyosaiModelId, setKyosaiModelId] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const localPreviewUrlRef = useRef<string | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEffectiveCowId(cowId);
  }, [cowId]);

  const releaseLocalPreviewUrl = useCallback(() => {
    if (
      localPreviewUrlRef.current &&
      typeof URL !== 'undefined' &&
      typeof URL.revokeObjectURL === 'function'
    ) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
    }
    localPreviewUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      releaseLocalPreviewUrl();
    };
  }, [releaseLocalPreviewUrl]);

  const setLocalAudioPreview = (file: File | null) => {
    if (!file) {
      releaseLocalPreviewUrl();
      setAudioPreview((prev) => (prev?.source === 'local' ? null : prev));
      return;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setAudioPreviewError('Your browser does not support audio preview.');
      return;
    }

    releaseLocalPreviewUrl();
    const localUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = localUrl;
    setAudioPreview({
      url: localUrl,
      source: 'local',
      label: `Selected audio: ${file.name}`,
    });
    setAudioPreviewError(null);
  };

  const setS3AudioPreview = useCallback(async (audioKey: string) => {
    try {
      const signed = await getUrl({
        path: audioKey,
        options: {
          validateObjectExistence: true,
          expiresIn: 3600,
        },
      });
      setAudioPreview({
        url: signed.url.toString(),
        source: 's3',
        label: `Pipeline audio source: ${audioKey}`,
      });
      setAudioPreviewError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAudioPreviewError(`Failed to generate audio preview URL: ${msg}`);
    }
  }, []);

  useEffect(() => {
    if (!result?.audioKey) return;
    void setS3AudioPreview(result.audioKey);
  }, [result?.audioKey, setS3AudioPreview]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const resetOutput = () => {
    setError(null);
    setResult(null);
    setCopyStatus('idle');
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    resetOutput();
  };

  const applyResult = (
    data: PipelineResult | null,
    errors: { message: string }[] | null | undefined
  ) => {
    if (errors && errors.length > 0) {
      const msg = errors.map((e) => e.message).join('\n');
      setError(msg);
      onError?.(msg);
    } else if (data) {
      setResult(data);
      setCopyStatus('idle');
      onPipelineComplete?.(data);
    }
  };

  const buildDevModelOverrides = (): Partial<Parameters<typeof client.queries.runPipeline>[0]> => {
    if (mode !== 'dev') return {};
    const overrides: Partial<Parameters<typeof client.queries.runPipeline>[0]> = {};
    if (extractorModelId.trim()) overrides.extractorModelId = extractorModelId.trim();
    if (soapModelId.trim()) overrides.soapModelId = soapModelId.trim();
    if (kyosaiModelId.trim()) overrides.kyosaiModelId = kyosaiModelId.trim();
    return overrides;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const extractedJsonDisplay =
    result?.extractedJson != null
      ? formatExtractedJsonForDisplay(result.extractedJson)
      : null;

  const runAudioPipelineWithPolling = async (
    entryPoint: 'AUDIO_FILE' | 'PRODUCTION',
    audioKey: string
  ) => {
    let visitId: string | undefined;
    let transcribeJobName: string | undefined;

    for (let poll = 0; poll < AUDIO_PIPELINE_MAX_POLLS; poll++) {
      setUploadStatus(poll > 0 ? TRANSCRIPTION_WAITING_LABEL : TRANSCRIPTION_STARTING_LABEL);

      const { data, errors } = await client.queries.runPipeline({
        entryPoint,
        cowId: effectiveCowId,
        audioKey,
        ...(visitId ? { visitId } : {}),
        ...(transcribeJobName ? { transcribeJobName } : {}),
        ...buildDevModelOverrides(),
      });

      if (errors && errors.length > 0) {
        applyResult(null, errors);
        return;
      }

      const pipelineResult = data as PipelineResult | null;
      if (!pipelineResult) {
        const msg = 'Pipeline result is empty.';
        setError(msg);
        onError?.(msg);
        return;
      }

      setResult(pipelineResult);
      visitId = pipelineResult.visitId;
      transcribeJobName = pipelineResult.transcribeJobName ?? undefined;

      if (pipelineResult.status !== 'IN_PROGRESS') {
        applyResult(pipelineResult, null);
        return;
      }

      if (!transcribeJobName) {
        const msg = 'Transcription job ID was not returned.';
        setError(msg);
        onError?.(msg);
        return;
      }

      await sleep(AUDIO_PIPELINE_POLL_INTERVAL_MS);
    }

    const timeoutMsg = 'Transcription wait timed out. Please retry in a moment.';
    setError(timeoutMsg);
    onError?.(timeoutMsg);
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTextInputRun = async () => {
    if (!transcriptText.trim()) {
      setError('Please enter clinical notes text.');
      return;
    }
    setLoading(true);
    resetOutput();
    try {
      const { data, errors } = await client.queries.runPipeline({
        entryPoint: 'TEXT_INPUT',
        cowId: effectiveCowId,
        transcriptText,
        ...buildDevModelOverrides(),
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioFileRun = async () => {
    if (!audioFile) {
      setError('Please select an audio file.');
      return;
    }
    setLoading(true);
    resetOutput();
    setUploadStatus(AUDIO_UPLOADING_LABEL);
    try {
      const key = `audio/${effectiveCowId}/${Date.now()}_${audioFile.name}`;
      await uploadData({
        path: key,
        data: audioFile,
        options: { contentType: audioFile.type || 'audio/wav' },
      }).result;
      await runAudioPipelineWithPolling('AUDIO_FILE', key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  const handleJsonInputRun = async () => {
    if (!jsonText.trim()) {
      setError('Please enter ExtractedJSON.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON format.');
      return;
    }
    setLoading(true);
    resetOutput();
    try {
      const { data, errors } = await client.queries.runPipeline({
        entryPoint: 'JSON_INPUT',
        cowId: effectiveCowId,
        extractedJson: parsed as Parameters<typeof client.queries.runPipeline>[0]['extractedJson'],
        ...buildDevModelOverrides(),
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleProductionUploadComplete = async (audioKey: string) => {
    setLoading(true);
    resetOutput();
    try {
      await runAudioPipelineWithPolling('PRODUCTION', audioKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="pipeline-entry-form">
      {/* cowId input: dev mode only */}
      {mode === 'dev' && showCowIdInput && (
        <div className={styles.cowIdRow}>
          <label htmlFor="pipeline-cow-id">Cow ID (cowId):</label>
          <input
            id="pipeline-cow-id"
            type="text"
            value={effectiveCowId}
            onChange={(e) => setEffectiveCowId(e.target.value)}
            placeholder="test-cow-001"
            className={styles.cowIdInput}
          />
        </div>
      )}

      {mode === 'dev' && (
        <div className={styles.modelOverrides}>
          <label className={styles.modelOverrideLabel}>
            Extractor Model:
            <select
              value={extractorModelId}
              onChange={(e) => setExtractorModelId(e.target.value)}
              className={styles.modelOverrideSelect}
            >
              {EXTRACTOR_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-extractor'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.modelOverrideLabel}>
            SOAP Model:
            <select
              value={soapModelId}
              onChange={(e) => setSoapModelId(e.target.value)}
              className={styles.modelOverrideSelect}
            >
              {SOAP_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-soap'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.modelOverrideLabel}>
            Kyosai Model:
            <select
              value={kyosaiModelId}
              onChange={(e) => setKyosaiModelId(e.target.value)}
              className={styles.modelOverrideSelect}
            >
              {KYOSAI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-kyosai'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            className={activeTab === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'TEXT_INPUT' && (
          <div>
            <h3>Text Input Mode</h3>
            <p>Enter clinical notes directly and run the pipeline.</p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Example: Temp 39.5C, reduced appetite, suspect displaced abomasum. IV glucose 500ml."
              rows={6}
              className={styles.field}
            />
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={handleTextInputRun}
                disabled={loading}
                className={styles.primaryButton}
              >
                {loading ? 'Processing...' : 'Run Pipeline'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'AUDIO_FILE' && (
          <div>
            <h3>Audio File Mode</h3>
            <p>Upload an audio file to S3 and run the pipeline.</p>
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setAudioFile(file);
                setLocalAudioPreview(file);
              }}
              className={styles.hiddenFileInput}
            />
            <div className={styles.filePickerRow}>
              <button
                type="button"
                className={styles.filePickerButton}
                onClick={() => audioFileInputRef.current?.click()}
              >
                Choose Audio File
              </button>
              <span className={styles.filePickerStatus}>
                {audioFile ? audioFile.name : 'No file selected'}
              </span>
            </div>
            {audioFile && (
              <p className={styles.fileInfo}>
                Selected: {audioFile.name} ({(audioFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {uploadStatus && (
              <p
                className={`${styles.statusText} ${styles.statusWaiting}`}
                role="status"
                aria-live="polite"
              >
                {uploadStatus}
                <span className={styles.statusDots} aria-hidden="true">
                  ...
                </span>
              </p>
            )}
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={handleAudioFileRun}
                disabled={loading || !audioFile}
                className={styles.primaryButton}
              >
                {loading ? 'Processing...' : 'Upload and Run'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'JSON_INPUT' && (
          <div>
            <h3>JSON Input Mode</h3>
            <p>Provide ExtractedJSON directly and run SOAP/Kyosai generation only.</p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "vital": { "temp_c": 39.5 }, "s": "Reduced appetite", "o": "Temp 39.5C", "a": [{ "name": "Displaced abomasum" }], "p": [{ "name": "IV glucose", "type": "drug" }] }'
              rows={10}
              className={styles.field}
            />
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={handleJsonInputRun}
                disabled={loading}
                className={styles.primaryButton}
              >
                {loading ? 'Processing...' : 'Run Pipeline'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'PRODUCTION' && (
          <div>
            <h3>DIAGNOSTIC_RECORDING</h3>
            <p>INITIATE_VOCAL_CAPTURE_FOR_PIPELINE_PROCESSING</p>
            <VoiceRecorder
              cowId={effectiveCowId}
              onUploadComplete={handleProductionUploadComplete}
              onError={(msg) => {
                setError(msg);
                onError?.(msg);
              }}
            />
            {loading && <p className={styles.statusText}>PIPELINE_PROCESSING_ACTIVE...</p>}
            {uploadStatus && (
              <p
                className={`${styles.statusText} ${styles.statusWaiting}`}
                role="status"
                aria-live="polite"
              >
                {uploadStatus}
                <span className={styles.statusDots} aria-hidden="true">
                  ...
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div role="alert" className={styles.errorBox}>
          <strong>SYSTEM_ERROR:</strong> {error}
        </div>
      )}

      {audioPreview && (
        <div className={styles.audioPreviewSection}>
          <h3>AUDIO_PREVIEW</h3>
          <p className={styles.audioMeta}>{audioPreview.label}</p>
          <audio controls src={audioPreview.url} className={styles.audioPlayer} />
        </div>
      )}
      {audioPreviewError && (
        <p className={styles.audioPreviewError}>
          {audioPreviewError}
        </p>
      )}

      {/* Result display */}
      {result && (
        <div className={styles.resultSection}>
          <h3>PIPELINE_OUTPUT</h3>
          <ResultField label="VISIT_ID" value={result.visitId} />
          <ResultField label="COW_ID" value={result.cowId} />
          <ResultField label="STATUS" value={result.status} />
          <ResultField label="TRANSCRIBE_JOB_NAME" value={result.transcribeJobName} />
          <ResultField label="TEMPLATE_TYPE" value={result.templateType} />
          {result.transcriptRaw != null && (
            <ResultField label="TRANSCRIPT_[RAW]" value={result.transcriptRaw} />
          )}
          {result.transcriptExpanded != null && (
            <ResultField label="TRANSCRIPT_[EXPANDED]" value={result.transcriptExpanded} />
          )}
          {extractedJsonDisplay && (
            <div className={styles.resultField}>
              <div className={styles.resultCardHeader}>
                <strong>EXTRACTED_JSON:</strong>
                <div className={styles.resultCardActions}>
                  {copyStatus === 'done' && (
                    <span className={styles.copyHint} aria-live="polite">
                      Copied
                    </span>
                  )}
                  {copyStatus === 'failed' && (
                    <span className={styles.copyHintError} aria-live="polite">
                      Copy failed
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={async () => {
                      const ok = await copyToClipboard(extractedJsonDisplay.text);
                      setCopyStatus(ok ? 'done' : 'failed');
                      setTimeout(() => setCopyStatus('idle'), 1800);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              {extractedJsonDisplay.isRawFallback && (
                <p className={styles.resultHint}>
                  Raw value shown because structured JSON formatting failed.
                </p>
              )}
              <pre className={styles.resultPreExtracted}>
                {extractedJsonDisplay.text}
              </pre>
            </div>
          )}
          {result.soapText != null && (
            <div className={styles.resultField}>
              <strong>SOAP_OUTPUT:</strong>
              <pre className={styles.resultPreSoap}>{result.soapText}</pre>
            </div>
          )}
          {result.kyosaiText != null && (
            <div className={styles.resultField}>
              <strong>KYOSAI_OUTPUT:</strong>
              <pre className={styles.resultPreKyosai}>{result.kyosaiText}</pre>
            </div>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div className={styles.resultField}>
              <strong>WARNINGS:</strong>
              <ul className={styles.warningList}>
                {result.warnings.map((w, i) => (
                  <li key={i} className={styles.warningItem}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResultField({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null;
  return (
    <div className={styles.resultField}>
      <strong>{label}:</strong> <span>{value}</span>
    </div>
  );
}

export default PipelineEntryForm;
