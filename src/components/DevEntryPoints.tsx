/**
 * Development entry points UI
 *
 * Refactored: thin wrapper around PipelineEntryForm with mode="dev"
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
import { PipelineEntryForm } from './PipelineEntryForm';

export function DevEntryPoints() {
  return (
    <div className="dev-entry-points">
      <h2>開発用エントリポイント</h2>
      <PipelineEntryForm
        cowId="test-cow-001"
        mode="dev"
      />
    </div>
  );
}

export default DevEntryPoints;
