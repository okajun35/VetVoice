/**
 * TemplateSelector component
 * Task 24.1: Display and allow manual change of template type
 * Requirements: 16.2, 16.4
 */
import { TEMPLATES, type TemplateType } from '../lib/templates';

export interface TemplateSelectorProps {
  /** Currently selected template type */
  selectedType: TemplateType;
  /** Callback when user changes template */
  onTypeChange: (type: TemplateType) => void;
  /** List of missing required fields (optional) */
  missingFields?: string[];
  /** Whether the template was auto-selected (optional) */
  autoSelected?: boolean;
}

const TEMPLATE_COLORS: Record<TemplateType, { bg: string; border: string; text: string }> = {
  general_soap:     { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  reproduction_soap: { bg: '#f3e5f5', border: '#7b1fa2', text: '#4a148c' },
  hoof_soap:        { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
  kyosai:           { bg: '#fff8e1', border: '#f57f17', text: '#e65100' },
};

export function TemplateSelector({
  selectedType,
  onTypeChange,
  missingFields = [],
  autoSelected = false,
}: TemplateSelectorProps) {
  return (
    <div
      style={{
        padding: '1rem',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#333' }}>
          テンプレート選択
        </span>
        {autoSelected && (
          <span
            style={{
              padding: '0.1rem 0.5rem',
              background: '#e8f5e9',
              color: '#2e7d32',
              border: '1px solid #a5d6a7',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 'bold',
            }}
          >
            自動選択
          </span>
        )}
      </div>

      {/* Template radio buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {TEMPLATES.map((template) => {
          const isSelected = template.type === selectedType;
          const colors = TEMPLATE_COLORS[template.type];

          return (
            <label
              key={template.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.9rem',
                background: isSelected ? colors.bg : '#fafafa',
                border: `1px solid ${isSelected ? colors.border : '#e0e0e0'}`,
                borderLeft: `4px solid ${isSelected ? colors.border : '#e0e0e0'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <input
                type="radio"
                name="template-type"
                value={template.type}
                checked={isSelected}
                onChange={() => onTypeChange(template.type)}
                style={{ accentColor: colors.border, width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  color: isSelected ? colors.text : '#555',
                }}
              >
                {template.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* Missing fields warning */}
      {missingFields.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.9rem',
            background: '#fff8e1',
            border: '1px solid #ffe082',
            borderLeft: '4px solid #f9a825',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 'bold',
              color: '#e65100',
              marginBottom: '0.3rem',
            }}
          >
            ⚠ 必須フィールドが不足しています
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.2rem',
              fontSize: '0.82rem',
              color: '#bf360c',
            }}
          >
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;
