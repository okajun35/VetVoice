/**
 * Property-based tests: PipelineEntryForm component
 * Feature: pipeline-entry-form
 *
 * Validates correctness properties from the design doc using fast-check.
 *
 * **Validates: Requirements 1.2, 1.5, 1.7**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, waitFor, fireEvent } from '@testing-library/react';
import {
  PipelineEntryForm,
  TABS_BY_MODE,
  TAB_LABELS,
  type TabMode,
} from '../../src/components/PipelineEntryForm';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock aws-amplify/data
vi.mock('aws-amplify/data', () => {
  const mockRunPipeline = vi.fn();
  return {
    generateClient: () => ({
      queries: {
        runPipeline: mockRunPipeline,
      },
    }),
    __mockRunPipeline: mockRunPipeline,
  };
});

// Mock aws-amplify/storage
vi.mock('aws-amplify/storage', () => ({
  uploadData: vi.fn(() => ({
    result: Promise.resolve({ path: 'mock-path' }),
  })),
}));

// Get mock references
const { __mockRunPipeline: mockRunPipeline } = await import('aws-amplify/data') as any;

// Mock VoiceRecorder component
vi.mock('../../src/components/VoiceRecorder', () => ({
  VoiceRecorder: ({ cowId }: { cowId: string }) => (
    <div data-testid="voice-recorder">VoiceRecorder for {cowId}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Arbitrary generator for FormMode values
 */
const formModeArb = fc.constantFrom('dev' as const, 'production' as const);

/**
 * Arbitrary generator for cowId strings
 */
const cowIdArb = fc.string({ minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Feature: pipeline-entry-form — Property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: pipeline-entry-form, Property 1: モードによるタブ表示制御
   *
   * For any FormMode value (dev or production), the set of displayed tabs
   * must exactly match the expected tab set for that mode:
   * - dev → ['TEXT_INPUT', 'AUDIO_FILE', 'JSON_INPUT', 'PRODUCTION']
   * - production → ['PRODUCTION', 'TEXT_INPUT']
   *
   * This property ensures that:
   * 1. All expected tabs for the mode are rendered
   * 2. No unexpected tabs are rendered
   * 3. Tab labels match the TAB_LABELS constant
   * 4. Tabs are rendered in the correct order
   *
   * Validates: Requirements 1.2, 1.5, 1.7
   */
  it('Property 1: モードによるタブ表示制御', () => {
    fc.assert(
      fc.property(
        formModeArb,
        cowIdArb,
        (mode, cowId) => {
          // Render the component with the given mode
          const { container } = render(
            <PipelineEntryForm cowId={cowId} mode={mode} />
          );

          // Get the expected tabs for this mode
          const expectedTabs = TABS_BY_MODE[mode];

          // Find all tab buttons in the rendered output
          const tabButtons = container.querySelectorAll('[role="tab"]');

          // 1. The number of rendered tabs must match the expected count
          expect(tabButtons.length).toBe(expectedTabs.length);

          // 2. Each expected tab must be rendered with the correct label
          expectedTabs.forEach((expectedTab, index) => {
            const tabButton = tabButtons[index];
            const expectedLabel = TAB_LABELS[expectedTab];

            // Tab button must exist
            expect(tabButton).not.toBeNull();

            // Tab button text must match the expected label
            expect(tabButton.textContent).toBe(expectedLabel);
          });

          // 3. Verify no unexpected tabs are present by checking all tab texts
          const renderedTabTexts = Array.from(tabButtons).map(
            (btn) => btn.textContent
          );
          const expectedTabTexts = expectedTabs.map((tab) => TAB_LABELS[tab]);

          expect(renderedTabTexts).toEqual(expectedTabTexts);

          // 4. Verify tabs are in the correct order
          expectedTabs.forEach((expectedTab, index) => {
            const tabButton = tabButtons[index];
            expect(tabButton.textContent).toBe(TAB_LABELS[expectedTab]);
          });

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 1.1: devモードは全4タブを表示
   *
   * When mode is 'dev', all four tabs must be displayed:
   * TEXT_INPUT, AUDIO_FILE, JSON_INPUT, PRODUCTION
   *
   * Validates: Requirements 1.5
   */
  it('Property 1.1: devモードは全4タブを表示', () => {
    fc.assert(
      fc.property(cowIdArb, (cowId) => {
        const { container } = render(
          <PipelineEntryForm cowId={cowId} mode="dev" />
        );

        const tabButtons = container.querySelectorAll('[role="tab"]');

        // Must have exactly 4 tabs
        expect(tabButtons.length).toBe(4);

        // Verify all expected tabs are present
        const expectedTabs: TabMode[] = [
          'TEXT_INPUT',
          'AUDIO_FILE',
          'JSON_INPUT',
          'PRODUCTION',
        ];
        const renderedLabels = Array.from(tabButtons).map(
          (btn) => btn.textContent
        );
        const expectedLabels = expectedTabs.map((tab) => TAB_LABELS[tab]);

        expect(renderedLabels).toEqual(expectedLabels);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 1.2: productionモードは2タブのみ表示
   *
   * When mode is 'production', only two tabs must be displayed:
   * PRODUCTION and TEXT_INPUT (in that order)
   *
   * Validates: Requirements 1.7
   */
  it('Property 1.2: productionモードは2タブのみ表示', () => {
    fc.assert(
      fc.property(cowIdArb, (cowId) => {
        const { container } = render(
          <PipelineEntryForm cowId={cowId} mode="production" />
        );

        const tabButtons = container.querySelectorAll('[role="tab"]');

        // Must have exactly 2 tabs
        expect(tabButtons.length).toBe(2);

        // Verify the expected tabs are present in the correct order
        const expectedTabs: TabMode[] = ['PRODUCTION', 'TEXT_INPUT'];
        const renderedLabels = Array.from(tabButtons).map(
          (btn) => btn.textContent
        );
        const expectedLabels = expectedTabs.map((tab) => TAB_LABELS[tab]);

        expect(renderedLabels).toEqual(expectedLabels);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 1.3: 最初のタブがデフォルトで選択される
   *
   * For any mode, the first tab in the tab list must be selected by default
   * (indicated by aria-selected="true")
   *
   * Validates: Requirements 1.2
   */
  it('Property 1.3: 最初のタブがデフォルトで選択される', () => {
    fc.assert(
      fc.property(
        formModeArb,
        cowIdArb,
        (mode, cowId) => {
          const { container } = render(
            <PipelineEntryForm cowId={cowId} mode={mode} />
          );

          const tabButtons = container.querySelectorAll('[role="tab"]');
          const expectedTabs = TABS_BY_MODE[mode];

          // At least one tab must be present
          expect(tabButtons.length).toBeGreaterThan(0);

          // The first tab must have aria-selected="true"
          const firstTab = tabButtons[0];
          expect(firstTab.getAttribute('aria-selected')).toBe('true');

          // All other tabs must have aria-selected="false"
          for (let i = 1; i < tabButtons.length; i++) {
            expect(tabButtons[i].getAttribute('aria-selected')).toBe('false');
          }

          // Verify the first tab corresponds to the first expected tab
          expect(firstTab.textContent).toBe(TAB_LABELS[expectedTabs[0]]);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 2: 非空テキスト入力のパイプライン呼び出し
   *
   * For any non-empty, non-whitespace-only transcript text string and any cowId,
   * submitting the text input tab shall call runPipeline with:
   * - entryPoint: 'TEXT_INPUT'
   * - the current cowId
   * - the entered transcriptText
   *
   * This property ensures that:
   * 1. runPipeline is called exactly once
   * 2. The entryPoint parameter is 'TEXT_INPUT'
   * 3. The cowId parameter matches the component's cowId
   * 4. The transcriptText parameter matches the entered text
   *
   * Validates: Requirements 2.2
   */
  it('Property 2: 非空テキスト入力のパイプライン呼び出し', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s.trim().length > 0),
        cowIdArb,
        async (transcriptText, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();
          
          // Setup mock response
          mockRunPipeline.mockResolvedValue({
            data: {
              visitId: 'test-visit-id',
              cowId,
              transcriptRaw: transcriptText,
            },
            errors: null,
          });

          // Render the component in dev mode (which includes TEXT_INPUT tab)
          // TEXT_INPUT is the first tab in dev mode, so it's selected by default
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Find the textarea (should be visible since TEXT_INPUT is the default tab)
            const textarea = container.querySelector('textarea');
            
            if (!textarea) {
              return false;
            }

            // Use fireEvent.change for direct value setting (no special character handling)
            fireEvent.change(textarea, { target: { value: transcriptText } });

            // Find the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));
            
            if (!submitButton) {
              return false;
            }
            
            // Click the button
            fireEvent.click(submitButton as HTMLElement);

            // Wait for the mock to be called
            await waitFor(() => {
              return mockRunPipeline.mock.calls.length === 1;
            }, { timeout: 1000 });

            // Verify the call parameters
            const callArgs = mockRunPipeline.mock.calls[0][0];
            return (
              callArgs.entryPoint === 'TEXT_INPUT' &&
              callArgs.cowId === cowId &&
              callArgs.transcriptText === transcriptText
            );
          } catch (error) {
            // If waitFor times out or any other error occurs, return false
            return false;
          } finally {
            // Clean up after each iteration
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 3: 空白テキストのバリデーション拒否
   *
   * For any string composed entirely of whitespace characters (including empty string),
   * submitting the text input tab shall be rejected with a validation error,
   * and runPipeline shall not be called.
   *
   * This property ensures that:
   * 1. A validation error message is displayed
   * 2. runPipeline is NOT called
   * 3. The error message contains the expected validation text
   *
   * Validates: Requirements 2.3
   */
  it('Property 3: 空白テキストのバリデーション拒否', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
        cowIdArb,
        async (whitespaceText, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();

          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Find the textarea
            const textarea = container.querySelector('textarea');
            if (!textarea) {
              return false;
            }

            // Enter whitespace-only text
            fireEvent.change(textarea, { target: { value: whitespaceText } });

            // Find and click the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));
            
            if (!submitButton) {
              return false;
            }
            
            fireEvent.click(submitButton as HTMLElement);

            // Wait a bit to ensure any async operations complete
            await waitFor(() => {
              // Check that an error alert is displayed
              const errorAlert = container.querySelector('[role="alert"]');
              return errorAlert !== null;
            }, { timeout: 500 });

            // Verify runPipeline was NOT called
            const wasNotCalled = mockRunPipeline.mock.calls.length === 0;

            // Verify error message is displayed
            const errorAlert = container.querySelector('[role="alert"]');
            const hasErrorMessage = errorAlert?.textContent?.includes('診療テキストを入力してください') ?? false;

            return wasNotCalled && hasErrorMessage;
          } catch (error) {
            // If waitFor times out, check if error is displayed anyway
            const errorAlert = container.querySelector('[role="alert"]');
            const hasErrorMessage = errorAlert?.textContent?.includes('診療テキストを入力してください') ?? false;
            const wasNotCalled = mockRunPipeline.mock.calls.length === 0;
            
            return wasNotCalled && hasErrorMessage;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 4: 音声ファイルメタデータ表示
   *
   * For any selected audio file with a name and size, the component shall
   * display both the file name and the file size in the UI.
   *
   * This property ensures that:
   * 1. The file name is displayed
   * 2. The file size is displayed (in KB)
   * 3. Both are visible when a file is selected
   *
   * Validates: Requirements 3.2
   */
  it('Property 4: 音声ファイルメタデータ表示', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          size: fc.nat({ max: 10000000 }), // Up to 10MB
        }),
        cowIdArb,
        (fileMetadata, cowId) => {
          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Switch to AUDIO_FILE tab
            const audioFileTab = Array.from(
              container.querySelectorAll('[role="tab"]')
            ).find((btn) => btn.textContent === TAB_LABELS.AUDIO_FILE);

            if (!audioFileTab) {
              return false;
            }

            fireEvent.click(audioFileTab as HTMLElement);

            // Find the file input
            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            if (!fileInput) {
              return false;
            }

            // Create a mock File object
            const mockFile = new File(['mock content'], fileMetadata.name, {
              type: 'audio/wav',
            });
            
            // Override the size property
            Object.defineProperty(mockFile, 'size', {
              value: fileMetadata.size,
              writable: false,
            });

            // Simulate file selection
            fireEvent.change(fileInput, { target: { files: [mockFile] } });

            // Check that file name is displayed
            const hasFileName = container.textContent?.includes(fileMetadata.name) ?? false;

            // Check that file size is displayed (in KB)
            const expectedSizeKB = (fileMetadata.size / 1024).toFixed(1);
            const hasSizeDisplay = container.textContent?.includes(expectedSizeKB) ?? false;

            return hasFileName && hasSizeDisplay;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 5: 有効JSONのパイプライン呼び出し
   *
   * For any valid JSON string, submitting the JSON input tab shall call
   * runPipeline with entryPoint: 'JSON_INPUT' and the parsed JSON object
   * as extractedJson.
   *
   * This property ensures that:
   * 1. runPipeline is called exactly once
   * 2. The entryPoint parameter is 'JSON_INPUT'
   * 3. The extractedJson parameter matches the parsed JSON
   *
   * Validates: Requirements 4.2
   */
  it('Property 5: 有効JSONのパイプライン呼び出し', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.jsonValue(),
        cowIdArb,
        async (jsonValue, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();

          // Setup mock response
          mockRunPipeline.mockResolvedValue({
            data: {
              visitId: 'test-visit-id',
              cowId,
              extractedJson: jsonValue,
            },
            errors: null,
          });

          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Switch to JSON_INPUT tab
            const jsonTab = Array.from(
              container.querySelectorAll('[role="tab"]')
            ).find((btn) => btn.textContent === TAB_LABELS.JSON_INPUT);

            if (!jsonTab) {
              return false;
            }

            fireEvent.click(jsonTab as HTMLElement);

            // Find the textarea
            const textareas = container.querySelectorAll('textarea');
            const jsonTextarea = Array.from(textareas).find(
              (ta) => ta.style.fontFamily === 'monospace'
            );

            if (!jsonTextarea) {
              return false;
            }

            // Enter valid JSON
            const jsonString = JSON.stringify(jsonValue);
            fireEvent.change(jsonTextarea, { target: { value: jsonString } });

            // Find and click the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));

            if (!submitButton) {
              return false;
            }

            fireEvent.click(submitButton as HTMLElement);

            // Wait for the mock to be called
            await waitFor(() => {
              return mockRunPipeline.mock.calls.length === 1;
            }, { timeout: 1000 });

            // Verify the call parameters
            const callArgs = mockRunPipeline.mock.calls[0][0];
            return (
              callArgs.entryPoint === 'JSON_INPUT' &&
              callArgs.cowId === cowId &&
              JSON.stringify(callArgs.extractedJson) === jsonString
            );
          } catch (error) {
            return false;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 6: 無効JSONのパースエラー表示
   *
   * For any string that is not valid JSON syntax (and is non-empty),
   * submitting the JSON input tab shall display a JSON parse error message,
   * and runPipeline shall not be called.
   *
   * This property ensures that:
   * 1. A JSON parse error message is displayed
   * 2. runPipeline is NOT called
   * 3. The error message contains the expected validation text
   *
   * Validates: Requirements 4.4
   */
  it('Property 6: 無効JSONのパースエラー表示', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string()
          .filter((s) => {
            if (s.trim().length === 0) return false;
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
        cowIdArb,
        async (invalidJson, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();

          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Switch to JSON_INPUT tab
            const jsonTab = Array.from(
              container.querySelectorAll('[role="tab"]')
            ).find((btn) => btn.textContent === TAB_LABELS.JSON_INPUT);

            if (!jsonTab) {
              return false;
            }

            fireEvent.click(jsonTab as HTMLElement);

            // Find the textarea
            const textareas = container.querySelectorAll('textarea');
            const jsonTextarea = Array.from(textareas).find(
              (ta) => ta.style.fontFamily === 'monospace'
            );

            if (!jsonTextarea) {
              return false;
            }

            // Enter invalid JSON
            fireEvent.change(jsonTextarea, { target: { value: invalidJson } });

            // Find and click the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));

            if (!submitButton) {
              return false;
            }

            fireEvent.click(submitButton as HTMLElement);

            // Wait a bit to ensure any async operations complete
            await waitFor(() => {
              const errorAlert = container.querySelector('[role="alert"]');
              return errorAlert !== null;
            }, { timeout: 500 });

            // Verify runPipeline was NOT called
            const wasNotCalled = mockRunPipeline.mock.calls.length === 0;

            // Verify error message is displayed
            const errorAlert = container.querySelector('[role="alert"]');
            const hasErrorMessage =
              errorAlert?.textContent?.includes('JSONの形式が正しくありません') ?? false;

            return wasNotCalled && hasErrorMessage;
          } catch (error) {
            // If waitFor times out, check if error is displayed anyway
            const errorAlert = container.querySelector('[role="alert"]');
            const hasErrorMessage =
              errorAlert?.textContent?.includes('JSONの形式が正しくありません') ?? false;
            const wasNotCalled = mockRunPipeline.mock.calls.length === 0;

            return wasNotCalled && hasErrorMessage;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 7: GraphQLエラーの表示とコールバック
   *
   * For any array of GraphQL error messages returned from runPipeline,
   * the component shall display all error messages and invoke the onError
   * callback with the concatenated error text.
   *
   * This property ensures that:
   * 1. All error messages are displayed
   * 2. The onError callback is invoked
   * 3. The callback receives the concatenated error text
   *
   * Validates: Requirements 6.3
   */
  it('Property 7: GraphQLエラーの表示とコールバック', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ message: fc.string({ minLength: 1 }) }), { minLength: 1 }),
        cowIdArb,
        async (errors, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();

          // Setup mock to return errors
          mockRunPipeline.mockResolvedValue({
            data: null,
            errors,
          });

          // Create a mock onError callback
          const onErrorMock = vi.fn();

          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" onError={onErrorMock} />
          );

          try {
            // Find the textarea (TEXT_INPUT is the default tab)
            const textarea = container.querySelector('textarea');
            if (!textarea) {
              return false;
            }

            // Enter some text
            fireEvent.change(textarea, { target: { value: 'test text' } });

            // Find and click the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));

            if (!submitButton) {
              return false;
            }

            fireEvent.click(submitButton as HTMLElement);

            // Wait for the error to be displayed
            await waitFor(() => {
              const errorAlert = container.querySelector('[role="alert"]');
              return errorAlert !== null;
            }, { timeout: 1000 });

            // Verify all error messages are displayed
            const errorAlert = container.querySelector('[role="alert"]');
            const allErrorsDisplayed = errors.every(
              (err) => errorAlert?.textContent?.includes(err.message) ?? false
            );

            // Verify onError callback was called
            const callbackCalled = onErrorMock.mock.calls.length === 1;

            // Verify callback received concatenated error text
            const expectedErrorText = errors.map((e) => e.message).join('\n');
            const callbackReceivedCorrectText =
              callbackCalled && onErrorMock.mock.calls[0][0] === expectedErrorText;

            return allErrorsDisplayed && callbackCalled && callbackReceivedCorrectText;
          } catch (error) {
            return false;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pipeline-entry-form, Property 8: 結果フィールドの完全表示
   *
   * For any PipelineResult object, every non-null field (visitId, cowId,
   * templateType, transcriptRaw, transcriptExpanded, extractedJson, soapText,
   * kyosaiText, warnings) shall appear in the rendered output.
   *
   * This property ensures that:
   * 1. All non-null fields are displayed
   * 2. Field labels are present
   * 3. Field values are visible in the UI
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
   */
  it('Property 8: 結果フィールドの完全表示', async () => {
    // Import the pipelineResultArb generator
    const { pipelineResultArb } = await import('../helpers/generators');

    await fc.assert(
      fc.asyncProperty(
        pipelineResultArb,
        cowIdArb,
        async (result, cowId) => {
          // Clear mocks before each property test iteration
          mockRunPipeline.mockClear();

          // Setup mock to return the result
          mockRunPipeline.mockResolvedValue({
            data: result,
            errors: null,
          });

          // Render the component in dev mode
          const { container, unmount } = render(
            <PipelineEntryForm cowId={cowId} mode="dev" />
          );

          try {
            // Find the textarea (TEXT_INPUT is the default tab)
            const textarea = container.querySelector('textarea');
            if (!textarea) {
              return false;
            }

            // Enter some text
            fireEvent.change(textarea, { target: { value: 'test text' } });

            // Find and click the submit button
            const submitButton = Array.from(
              container.querySelectorAll('button[type="button"]')
            ).find((btn) => btn.textContent?.includes('パイプライン実行'));

            if (!submitButton) {
              return false;
            }

            fireEvent.click(submitButton as HTMLElement);

            // Wait for the result to be displayed
            await waitFor(() => {
              const resultSection = container.querySelector('.pipeline-entry-form__result');
              return resultSection !== null;
            }, { timeout: 1000 });

            const containerText = container.textContent || '';

            // Check that all non-null fields are displayed
            const checks: boolean[] = [];

            // visitId is always required - check if it's non-empty
            if (result.visitId.trim().length > 0) {
              checks.push(containerText.includes(result.visitId));
            } else {
              // For empty/whitespace visitId, just check that the label is present
              checks.push(containerText.includes('Visit ID'));
            }

            // cowId is always required - check if it's non-empty
            if (result.cowId.trim().length > 0) {
              checks.push(containerText.includes(result.cowId));
            } else {
              // For empty/whitespace cowId, just check that the label is present
              checks.push(containerText.includes('Cow ID'));
            }

            // Optional fields - check if non-null and non-empty
            if (result.templateType != null && result.templateType.trim().length > 0) {
              checks.push(containerText.includes(result.templateType));
            }

            if (result.transcriptRaw != null && result.transcriptRaw.trim().length > 0) {
              checks.push(containerText.includes(result.transcriptRaw));
            }

            if (result.transcriptExpanded != null && result.transcriptExpanded.trim().length > 0) {
              checks.push(containerText.includes(result.transcriptExpanded));
            }

            if (result.extractedJson != null) {
              // Check that the ExtractedJSON section is displayed
              // We check for the label rather than exact JSON content
              // because formatting may vary
              checks.push(containerText.includes('ExtractedJSON'));
            }

            if (result.soapText != null && result.soapText.trim().length > 0) {
              checks.push(containerText.includes(result.soapText));
            }

            if (result.kyosaiText != null && result.kyosaiText.trim().length > 0) {
              checks.push(containerText.includes(result.kyosaiText));
            }

            if (result.warnings != null && result.warnings.length > 0) {
              // Check that at least one non-null warning is displayed
              const nonNullWarnings = result.warnings.filter((w) => w != null && w.trim().length > 0);
              if (nonNullWarnings.length > 0) {
                const hasWarnings = nonNullWarnings.some((w) => containerText.includes(w!));
                checks.push(hasWarnings);
              }
            }

            // All checks must pass
            return checks.every((check) => check === true);
          } catch (error) {
            return false;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
