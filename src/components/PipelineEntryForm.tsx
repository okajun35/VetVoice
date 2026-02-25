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

const MODEL_OPTIONS = [
  { value: '', label: '(default)' },
  { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (20250514)' },
  { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { value: 'anthropic.claude-3-7-sonnet-20250219-v1:0', label: 'Claude 3.7 Sonnet' },
  { value: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude 3.5 Haiku' },
];

const FIELD_STYLE = {
  width: '100%',
  minHeight: '2.25rem',
  padding: '0.45rem 0.6rem',
  border: '1px solid #c9d3e0',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#1f2937',
} as const;

const SELECT_STYLE = {
  ...FIELD_STYLE,
  appearance: 'auto',
} as const;

const PRIMARY_BUTTON_BASE_STYLE = {
  minHeight: '2.25rem',
  padding: '0.5rem 1.5rem',
  border: '1px solid #1e6bff',
  borderRadius: '6px',
  background: '#1e6bff',
  color: '#ffffff',
  fontWeight: 600,
} as const;

const getPrimaryButtonStyle = (disabled: boolean) => ({
  ...PRIMARY_BUTTON_BASE_STYLE,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
});

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
        <div className="pipeline-entry-form__cow-id">
          <label htmlFor="pipeline-cow-id">牛ID (cowId):</label>
          <input
            id="pipeline-cow-id"
            type="text"
            value={effectiveCowId}
            onChange={(e) => setEffectiveCowId(e.target.value)}
            placeholder="test-cow-001"
            style={{ ...FIELD_STYLE, marginLeft: '0.5rem', width: '200px' }}
          />
        </div>
      )}

      {mode === 'dev' && (
        <div
          className="pipeline-entry-form__model-overrides"
          style={{
            marginTop: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <label>
            Extractor Model:
            <select
              value={extractorModelId}
              onChange={(e) => setExtractorModelId(e.target.value)}
              style={{ ...SELECT_STYLE, marginLeft: '0.5rem' }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-extractor'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            SOAP Model:
            <select
              value={soapModelId}
              onChange={(e) => setSoapModelId(e.target.value)}
              style={{ ...SELECT_STYLE, marginLeft: '0.5rem' }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-soap'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kyosai Model:
            <select
              value={kyosaiModelId}
              onChange={(e) => setKyosaiModelId(e.target.value)}
              style={{ ...SELECT_STYLE, marginLeft: '0.5rem' }}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value || 'default-kyosai'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Tab bar */}
      <div
        className="pipeline-entry-form__tabs"
        role="tablist"
        style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              background: activeTab === tab ? '#e8f0fe' : '#ffffff',
              border: activeTab === tab ? '1px solid #0066cc' : '1px solid #ccc',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        className="pipeline-entry-form__content"
        style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '0 4px 4px 4px' }}
      >
        {activeTab === 'TEXT_INPUT' && (
          <div>
            <h3>テキスト入力モード</h3>
            <p>診療テキストを直接入力してパイプラインを実行します。</p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="例: 体温39.5度、食欲不振、第四胃変位疑い。ブドウ糖500ml静注。"
              rows={6}
              style={{ ...FIELD_STYLE, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleTextInputRun}
                disabled={loading}
                style={getPrimaryButtonStyle(loading)}
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
              style={{ ...FIELD_STYLE, appearance: 'auto' }}
            />
            {audioFile && (
              <p style={{ fontSize: '0.9rem', color: '#555' }}>
                選択中: {audioFile.name} ({(audioFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {uploadStatus && <p style={{ color: '#0066cc' }}>{uploadStatus}</p>}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleAudioFileRun}
                disabled={loading || !audioFile}
                style={getPrimaryButtonStyle(loading || !audioFile)}
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
              style={{ ...FIELD_STYLE, fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleJsonInputRun}
                disabled={loading}
                style={getPrimaryButtonStyle(loading)}
              >
                {loading ? '処理中...' : 'パイプライン実行'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'PRODUCTION' && (
          <div>
            <h3>本番モード（録音）</h3>
            <p>マイクで録音し、S3アップロード後にパイプラインを実行します。</p>
            <VoiceRecorder
              cowId={effectiveCowId}
              onUploadComplete={handleProductionUploadComplete}
              onError={(msg) => {
                setError(msg);
                onError?.(msg);
              }}
            />
            {loading && <p style={{ color: '#0066cc' }}>パイプライン処理中...</p>}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#fff0f0',
            border: '1px solid #cc0000',
            borderRadius: '4px',
            color: '#cc0000',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>エラー:</strong> {error}
        </div>
      )}

      {/* Result display */}
      {result && (
        <div className="pipeline-entry-form__result" style={{ marginTop: '1rem' }}>
          <h3>実行結果</h3>
          <ResultField label="Visit ID" value={result.visitId} />
          <ResultField label="Cow ID" value={result.cowId} />
          <ResultField label="テンプレートタイプ" value={result.templateType} />
          {result.transcriptRaw != null && (
            <ResultField label="文字起こし（raw）" value={result.transcriptRaw} />
          )}
          {result.transcriptExpanded != null && (
            <ResultField label="文字起こし（展開後）" value={result.transcriptExpanded} />
          )}
          {result.extractedJson != null && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong>ExtractedJSON:</strong>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: '0.85rem',
                  marginTop: '0.25rem',
                }}
              >
                {JSON.stringify(result.extractedJson, null, 2)}
              </pre>
            </div>
          )}
          {result.soapText != null && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong>SOAPテキスト:</strong>
              <pre
                style={{
                  background: '#f0f8ff',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontSize: '0.9rem',
                  marginTop: '0.25rem',
                }}
              >
                {result.soapText}
              </pre>
            </div>
          )}
          {result.kyosaiText != null && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong>家畜共済テキスト:</strong>
              <pre
                style={{
                  background: '#f0fff0',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontSize: '0.9rem',
                  marginTop: '0.25rem',
                }}
              >
                {result.kyosaiText}
              </pre>
            </div>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong>警告:</strong>
              <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                {result.warnings.map((w, i) => (
                  <li key={i} style={{ color: '#996600' }}>
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
    <div style={{ marginTop: '0.5rem' }}>
      <strong>{label}:</strong> <span>{value}</span>
    </div>
  );
}

export default PipelineEntryForm;
