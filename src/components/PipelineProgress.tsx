/**
 * PipelineProgress component
 * Task 21.1: Display pipeline processing progress
 * Requirements: 11.2
 */

export type PipelineStep =
  | 'transcribe'
  | 'expand'
  | 'extract'
  | 'match'
  | 'generate';

const STEP_LABELS: Record<PipelineStep, string> = {
  transcribe: '文字起こし',
  expand: '辞書展開',
  extract: '構造化抽出',
  match: 'マスタ照合',
  generate: 'SOAP/共済生成',
};

const STEPS: PipelineStep[] = ['transcribe', 'expand', 'extract', 'match', 'generate'];

export interface PipelineProgressProps {
  currentStep: PipelineStep | null;
  completedSteps: PipelineStep[];
  errorStep?: PipelineStep;
  isProcessing: boolean;
}

type StepState = 'pending' | 'active' | 'completed' | 'error';

function getStepState(
  step: PipelineStep,
  currentStep: PipelineStep | null,
  completedSteps: PipelineStep[],
  errorStep?: PipelineStep
): StepState {
  if (errorStep === step) return 'error';
  if (completedSteps.includes(step)) return 'completed';
  if (currentStep === step) return 'active';
  return 'pending';
}

const STATE_COLORS: Record<StepState, string> = {
  pending: '#9e9e9e',
  active: '#1976d2',
  completed: '#388e3c',
  error: '#d32f2f',
};

const STATE_BG: Record<StepState, string> = {
  pending: '#f5f5f5',
  active: '#e3f2fd',
  completed: '#e8f5e9',
  error: '#ffebee',
};

const STATE_BORDER: Record<StepState, string> = {
  pending: '#e0e0e0',
  active: '#90caf9',
  completed: '#a5d6a7',
  error: '#ef9a9a',
};

function StepIcon({ state }: { state: StepState }) {
  const size = 24;
  const color = STATE_COLORS[state];

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  if (state === 'completed') {
    return (
      <span
        aria-label="完了"
        style={{ ...baseStyle, background: color, color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
      >
        ✓
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span
        aria-label="エラー"
        style={{ ...baseStyle, background: color, color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
      >
        ✕
      </span>
    );
  }

  if (state === 'active') {
    return (
      <span
        aria-label="処理中"
        style={{
          ...baseStyle,
          border: `3px solid ${color}`,
          borderTopColor: 'transparent',
          animation: 'pipeline-spin 0.8s linear infinite',
        }}
      />
    );
  }

  return (
    <span
      aria-label="未処理"
      style={{ ...baseStyle, border: `2px solid ${color}` }}
    />
  );
}

function getStatusLabel(
  isProcessing: boolean,
  errorStep: PipelineStep | undefined,
  completedSteps: PipelineStep[]
): string {
  if (errorStep) return 'エラーが発生しました';
  if (completedSteps.length === STEPS.length) return '処理完了';
  if (isProcessing) return '処理中...';
  return '待機中';
}

export function PipelineProgress({
  currentStep,
  completedSteps,
  errorStep,
  isProcessing,
}: PipelineProgressProps) {
  return (
    <div
      role="status"
      aria-label="パイプライン処理進捗"
      style={{
        padding: '1rem',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
      }}
    >
      <style>{`
        @keyframes pipeline-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 'bold',
          color: '#555',
          marginBottom: '0.75rem',
        }}
      >
        {getStatusLabel(isProcessing, errorStep, completedSteps)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {STEPS.map((step) => {
          const state = getStepState(step, currentStep, completedSteps, errorStep);
          const color = STATE_COLORS[state];

          return (
            <div
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: STATE_BG[state],
                border: `1px solid ${STATE_BORDER[state]}`,
                borderRadius: '6px',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <StepIcon state={state} />
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: state === 'active' ? 'bold' : 'normal',
                  color,
                  flex: 1,
                }}
              >
                {STEP_LABELS[step]}
              </span>
              {state === 'active' && (
                <span style={{ fontSize: '0.8rem', color: '#1976d2' }}>
                  処理中
                </span>
              )}
              {state === 'error' && (
                <span style={{ fontSize: '0.8rem', color: '#d32f2f' }}>
                  エラー
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PipelineProgress;
