/**
 * Development entry points UI
 *
 * Task 27.1: 4-mode tab UI (TEXT_INPUT / AUDIO_FILE / JSON_INPUT / PRODUCTION)
 * Calls runPipeline query and displays results.
 */
import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { VoiceRecorder } from './VoiceRecorder';

const client = generateClient<Schema>();

type TabMode = 'TEXT_INPUT' | 'AUDIO_FILE' | 'JSON_INPUT' | 'PRODUCTION';

interface PipelineResult {
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

const TAB_LABELS: Record<TabMode, string> = {
  TEXT_INPUT: 'テキスト入力',
  AUDIO_FILE: '音声ファイル',
  JSON_INPUT: 'JSON入力',
  PRODUCTION: '本番（録音）',
};

const TAB_ORDER: TabMode[] = ['TEXT_INPUT', 'AUDIO_FILE', 'JSON_INPUT', 'PRODUCTION'];

export function DevEntryPoints() {
  const [activeTab, setActiveTab] = useState<TabMode>('TEXT_INPUT');
  const [cowId, setCowId] = useState('test-cow-001');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const [transcriptText, setTranscriptText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');

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
      setError(errors.map((e) => e.message).join('\n'));
    } else if (data) {
      setResult(data);
    }
  };

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
        cowId,
        transcriptText,
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
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
      const key = `audio/${cowId}/${Date.now()}_${audioFile.name}`;
      await uploadData({
        path: key,
        data: audioFile,
        options: { contentType: audioFile.type || 'audio/wav' },
      }).result;
      setUploadStatus('アップロード完了。パイプライン実行中...');
      const { data, errors } = await client.queries.runPipeline({
        entryPoint: 'AUDIO_FILE',
        cowId,
        audioKey: key,
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
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
        cowId,
        extractedJson: parsed,
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
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
        cowId,
        audioKey,
      });
      applyResult(data as PipelineResult | null, errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dev-entry-points">
      <h2>開発用エントリポイント</h2>

      <div className="dev-entry-points__cow-id">
        <label htmlFor="dev-cow-id">牛ID (cowId):</label>
        <input
          id="dev-cow-id"
          type="text"
          value={cowId}
          onChange={(e) => setCowId(e.target.value)}
          placeholder="test-cow-001"
          style={{ marginLeft: '0.5rem', width: '200px' }}
        />
      </div>

      <div
        className="dev-entry-points__tabs"
        role="tablist"
        style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}
      >
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              background: activeTab === tab ? '#e8f0fe' : 'none',
              border: activeTab === tab ? '1px solid #0066cc' : '1px solid #ccc',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div
        className="dev-entry-points__content"
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
              style={{ width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleTextInputRun}
                disabled={loading}
                style={{ padding: '0.5rem 1.5rem' }}
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
                style={{ padding: '0.5rem 1.5rem' }}
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
              style={{ width: '100%', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleJsonInputRun}
                disabled={loading}
                style={{ padding: '0.5rem 1.5rem' }}
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
              cowId={cowId}
              onUploadComplete={handleProductionUploadComplete}
              onError={(msg) => setError(msg)}
            />
            {loading && <p style={{ color: '#0066cc' }}>パイプライン処理中...</p>}
          </div>
        )}
      </div>

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

      {result && (
        <div className="dev-entry-points__result" style={{ marginTop: '1rem' }}>
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

function ResultField({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <strong>{label}:</strong> <span>{value}</span>
    </div>
  );
}

export default DevEntryPoints;
