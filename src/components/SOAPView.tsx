/**
 * SOAPView component
 * Task 23.1: Display SOAP format text with unconfirmed highlights
 * Requirements: 8.1, 8.4
 */
import { useState } from 'react';

export interface SOAPViewProps {
  soapText: string;
  templateType?: string;
}

const SOAP_SECTION_COLORS: Record<string, string> = {
  'S:': '#e8f4fd',
  'O:': '#e8fde8',
  'A:': '#fdf8e8',
  'P:': '#fde8e8',
};

const SOAP_SECTION_BORDER: Record<string, string> = {
  'S:': '#2196f3',
  'O:': '#4caf50',
  'A:': '#ff9800',
  'P:': '#f44336',
};

const SOAP_SECTION_LABELS: Record<string, string> = {
  'S:': 'S（稟告）',
  'O:': 'O（所見）',
  'A:': 'A（評価）',
  'P:': 'P（計画）',
};

const TEMPLATE_LABELS: Record<string, string> = {
  general_soap: '一般診療SOAP',
  reproduction_soap: '繁殖SOAP',
  hoof_soap: '蹄病SOAP',
  kyosai: '家畜共済',
};

function parseSoapSections(text: string): Array<{ header: string; lines: string[] }> {
  const sections: Array<{ header: string; lines: string[] }> = [];
  let currentHeader = '';
  let currentLines: string[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    const sectionKey = Object.keys(SOAP_SECTION_COLORS).find((k) => trimmed.startsWith(k));
    if (sectionKey) {
      if (currentHeader || currentLines.length > 0) {
        sections.push({ header: currentHeader, lines: currentLines });
      }
      currentHeader = sectionKey;
      const rest = trimmed.slice(sectionKey.length).trim();
      currentLines = rest ? [rest] : [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentHeader || currentLines.length > 0) {
    sections.push({ header: currentHeader, lines: currentLines });
  }
  return sections;
}

function HighlightedLine({ line }: { line: string }) {
  const isUnconfirmed = line.includes('（未確認）');
  return (
    <div
      style={{
        padding: '0.2rem 0.4rem',
        borderRadius: '3px',
        background: isUnconfirmed ? '#fff3e0' : 'transparent',
        borderLeft: isUnconfirmed ? '3px solid #ff9800' : '3px solid transparent',
        marginBottom: '0.1rem',
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: isUnconfirmed ? '#e65100' : 'inherit',
      }}
    >
      {line || '\u00a0'}
    </div>
  );
}

export function SOAPView({ soapText, templateType }: SOAPViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(soapText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = soapText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sections = parseSoapSections(soapText);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
            SOAPサマリー
          </h3>
          {templateType && (
            <span
              style={{
                padding: '0.15rem 0.5rem',
                background: '#e3f2fd',
                color: '#1565c0',
                borderRadius: '3px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              }}
            >
              {TEMPLATE_LABELS[templateType] ?? templateType}
            </span>
          )}
        </div>
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
      </div>

      {sections.length === 0 ? (
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
          SOAPテキストがありません
        </div>
      ) : (
        sections.map((section, idx) => {
          const bg = section.header ? SOAP_SECTION_COLORS[section.header] : '#fafafa';
          const border = section.header ? SOAP_SECTION_BORDER[section.header] : '#e0e0e0';
          const label = section.header ? SOAP_SECTION_LABELS[section.header] : '';
          return (
            <div
              key={idx}
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: bg,
                border: `1px solid ${border}`,
                borderLeft: `4px solid ${border}`,
                borderRadius: '6px',
              }}
            >
              {label && (
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    color: border,
                    marginBottom: '0.4rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {label}
                </div>
              )}
              {section.lines.map((line, lineIdx) => (
                <HighlightedLine key={lineIdx} line={line} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

export default SOAPView;
