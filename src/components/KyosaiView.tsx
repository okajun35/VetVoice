/**
 * KyosaiView component
 * Task 23.2: Display livestock mutual aid (kyosai) draft with manual-entry highlights
 * Requirements: 9.1, 9.4
 */
import { useState } from 'react';

export interface KyosaiViewProps {
  kyosaiText: string;
}

function HighlightedLine({ line }: { line: string }) {
  const needsManualEntry = line.includes('（手動入力が必要です）');
  return (
    <div
      style={{
        padding: '0.2rem 0.4rem',
        borderRadius: '3px',
        background: needsManualEntry ? '#ffebee' : 'transparent',
        borderLeft: needsManualEntry ? '3px solid #f44336' : '3px solid transparent',
        marginBottom: '0.1rem',
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: needsManualEntry ? '#c62828' : 'inherit',
      }}
    >
      {line || '\u00a0'}
    </div>
  );
}

export function KyosaiView({ kyosaiText }: KyosaiViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(kyosaiText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = kyosaiText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const lines = kyosaiText.split('\n');

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
          家畜共済ドラフト
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              background: copied ? '#d4edda' : '#f5f5f5',
              color: copied ? '#155724' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              transition: 'background 0.2s',
            }}
          >
            {copied ? 'コピー済み ✓' : 'コピー'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            印刷
          </button>
        </div>
      </div>

      {kyosaiText.trim() === '' ? (
        <div
          style={{
            padding: '1rem',
            background: '#fafafa',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            color: '#888',
            fontSize: '0.9rem',
          }}
        >
          家畜共済テキストがありません
        </div>
      ) : (
        <div
          style={{
            padding: '0.75rem',
            background: '#f0fff0',
            border: '1px solid #c8e6c9',
            borderLeft: '4px solid #4caf50',
            borderRadius: '6px',
          }}
        >
          {lines.map((line, idx) => (
            <HighlightedLine key={idx} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}

export default KyosaiView;
