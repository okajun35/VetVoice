/**
 * PipelineProgress component
 * Task 21.1: Display pipeline processing progress
 * Requirements: 11.2
 */

import styles from './PipelineProgress.module.css';

export type PipelineStep =
  | 'transcribe'
  | 'expand'
  | 'extract'
  | 'match'
  | 'generate';

const STEP_LABELS: Record<PipelineStep, string> = {
  transcribe: 'TRANSCRIBE',
  expand: 'LEXICON_EXPAND',
  extract: 'JSON_EXTRACT',
  match: 'MASTER_MATCH',
  generate: 'SOAP_GEN',
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

function StepIcon({ state }: { state: StepState }) {
  if (state === 'completed') {
    return (
      <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
        {'[OK]'}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
        {'[!!]'}
      </span>
    );
  }

  if (state === 'active') {
    return (
      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
        {'[>>]'}
      </span>
    );
  }

  return (
    <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'bold' }}>
      {'[__]'}
    </span>
  );
}

function getStatusLabel(
  isProcessing: boolean,
  errorStep: PipelineStep | undefined,
  completedSteps: PipelineStep[]
): string {
  if (errorStep) return 'SYSTEM_FAILURE';
  if (completedSteps.length === STEPS.length) return 'SEQUENCE_COMPLETE';
  if (isProcessing) return 'PROCESSING_DATA';
  return 'STANDBY';
}

export function PipelineProgress({
  currentStep,
  completedSteps,
  errorStep,
  isProcessing,
}: PipelineProgressProps) {
  const overallStatus = getStatusLabel(isProcessing, errorStep, completedSteps);

  return (
    <div className={styles.container} role="status" aria-label="PIPELINE_PROGRESS">
      <div className={styles.statusHeader}>
        <span>PIPELINE_STATUS:</span>
        <span className={styles.statusValue}>{overallStatus}</span>
      </div>

      <div className={styles.stepList}>
        {STEPS.map((step) => {
          const state = getStepState(step, currentStep, completedSteps, errorStep);
          const isActive = state === 'active';

          return (
            <div
              key={step}
              className={`${styles.stepItem} ${state === 'active' ? styles.stepItemActive : ''
                } ${state === 'completed' ? styles.stepItemCompleted : ''} ${state === 'error' ? styles.stepItemError : ''
                }`}
            >
              <div className={styles.iconContainer}>
                <StepIcon state={state} />
              </div>
              <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''
                } ${state === 'completed' ? styles.stepLabelCompleted : ''}`}>
                {STEP_LABELS[step]}
              </span>

              {state === 'active' && (
                <span className={`${styles.stepStatus} ${styles.stepStatusActive}`}>
                  BUSY
                </span>
              )}
              {state === 'error' && (
                <span className={`${styles.stepStatus} ${styles.stepStatusError}`}>
                  FAIL
                </span>
              )}
              {state === 'completed' && (
                <span className={styles.stepStatus} style={{ color: 'var(--color-success)' }}>
                  DONE
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
