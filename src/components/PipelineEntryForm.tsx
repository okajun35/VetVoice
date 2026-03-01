/**
 * PipelineEntryForm - shared pipeline execution UI component
 *
 * Tasks 1.1-1.8: Extracted from DevEntryPoints.tsx
 * Supports dev mode (all 4 tabs + editable cowId) and
 * production mode (PRODUCTION + TEXT_INPUT tabs, cowId from props).
 */
import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
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
  transcriptRaw?: string | null;
  transcriptExpanded?: string | null;
  extractedJson?: unknown;
  soapText?: string | null;
  kyosaiText?: string | null;
  templateType?: string | null;
  warnings?: (string | null)[] | null;
}

export type { FormMode, TabMode } from './pipelineEntryForm.constants';

export interface PipelineEntryFormProps {
  cowId: string;
  mode: FormMode;
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
  { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (20250514)' },
  { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { value: 'anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet' },
  { value: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku' },
];

const SOAP_MODEL_OPTIONS = [
  { value: '', label: '(default) Amazon Nova Lite' },
  { value: 'us.amazon.nova-premier-v1:0', label: 'Amazon Nova Premier (US Profile)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (20250514)' },
  { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { value: 'anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet' },
  { value: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku' },
];

const KYOSAI_MODEL_OPTIONS = [
  { value: '', label: '(default) Amazon Nova Lite' },
  { value: 'us.amazon.nova-premier-v1:0', label: 'Amazon Nova Premier (US Profile)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (20250514)' },
  { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { value: 'anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet' },
  { value: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku' },
];

// Inline style constants removed - replaced by CSS Modules in PipelineEntryForm.module.css

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineEntryForm({
  cowId,
  mode,
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
  const [jsonText, setJsonText] = useState('');
  const [extractorModelId, setExtractorModelId] = useState('');
  const [soapModelId, setSoapModelId] = useState('');
  const [kyosaiModelId, setKyosaiModelId] = useState('');

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const resetOutput = () => {
    setError(null);
    setResult(null);
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

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTextInputRun = async () => {
    if (!transcriptText.trim()) {
      setError('診療テキストを入力してください。');
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
      const msg = e instanceof Error ? e.message : '不明なエラーが発生しました。';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioFileRun = async () => {
    if (!audioFile) {
      setError('音声ファイルを選択してください。');
      return;
    }
    setLoading(true);
    resetOutput();
    setUploadStatus('アップロード中...');
    try {
      const key = `audio/${effectiveCowId}/${Date.now()}_${audioFile.name}`;
      await uploadData({
        path: key,
        data: audioFile,
        options: { contentType: audioFile.type || 'audio/wav' },
      }).result;
      setUploadStatus('アップロード完了。パイプライン実行中...');
      const { data, errors } = await client.queries.runPipeline({
        entryPoint: 'AUDIO_FILE',
        cowId: effectiveCowId,
        audioKey: key,
        ...buildDevModelOverrides(),
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラーが発生しました。';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  const handleJsonInputRun = async () => {
    if (!jsonText.trim()) {
      setError('ExtractedJSONを入力してください。');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('JSONの形式が正しくありません。');
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
      const msg = e instanceof Error ? e.message : '不明なエラーが発生しました。';
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
      const { data, errors } = await client.queries.runPipeline({
        entryPoint: 'PRODUCTION',
        cowId: effectiveCowId,
        audioKey,
        ...buildDevModelOverrides(),
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラーが発生しました。';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="pipeline-entry-form">
      {/* cowId input: dev mode only */}
      {mode === 'dev' && (
        <div className={styles.cowIdRow}>
          <label htmlFor="pipeline-cow-id">牛ID (cowId):</label>
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
            <h3>テキスト入力モード</h3>
            <p>診療テキストを直接入力してパイプラインを実行します。</p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="例: 体温39.5度、食欲不振、第四胃変位疑い。ブドウ糖500ml静注。"
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
                {loading ? '処理中...' : 'パイプライン実行'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'AUDIO_FILE' && (
          <div>
            <h3>音声ファイルモード</h3>
            <p>音声ファイルをS3にアップロードしてパイプラインを実行します。</p>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className={styles.field}
            />
            {audioFile && (
              <p className={styles.fileInfo}>
                選択中: {audioFile.name} ({(audioFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {uploadStatus && <p className={styles.statusText}>{uploadStatus}</p>}
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={handleAudioFileRun}
                disabled={loading || !audioFile}
                className={styles.primaryButton}
              >
                {loading ? '処理中...' : 'アップロード＆実行'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'JSON_INPUT' && (
          <div>
            <h3>JSON入力モード</h3>
            <p>ExtractedJSONを直接入力してSOAP/共済生成のみ実行します。</p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "vital": { "temp_c": 39.5 }, "s": "食欲不振", "o": "体温39.5℃", "a": [{ "name": "第四胃変位" }], "p": [{ "name": "ブドウ糖静注", "type": "drug" }] }'
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
                {loading ? '処理中...' : 'パイプライン実行'}
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
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div role="alert" className={styles.errorBox}>
          <strong>SYSTEM_ERROR:</strong> {error}
        </div>
      )}

      {/* Result display */}
      {result && (
        <div className={styles.resultSection}>
          <h3>PIPELINE_OUTPUT</h3>
          <ResultField label="VISIT_ID" value={result.visitId} />
          <ResultField label="COW_ID" value={result.cowId} />
          <ResultField label="TEMPLATE_TYPE" value={result.templateType} />
          {result.transcriptRaw != null && (
            <ResultField label="TRANSCRIPT_[RAW]" value={result.transcriptRaw} />
          )}
          {result.transcriptExpanded != null && (
            <ResultField label="TRANSCRIPT_[EXPANDED]" value={result.transcriptExpanded} />
          )}
          {result.extractedJson != null && (
            <div className={styles.resultField}>
              <strong>ExtractedJSON:</strong>
              <pre className={styles.resultPre}>
                {JSON.stringify(result.extractedJson, null, 2)}
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
