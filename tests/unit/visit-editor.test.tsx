import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitEditor } from '../../src/components/VisitEditor';

vi.mock('aws-amplify/data', () => {
  const mockClient = {
    models: {
      Visit: {
        get: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
      },
      VisitEdit: {
        create: vi.fn(),
      },
    },
  };

  return {
    generateClient: () => mockClient,
    __mockClient: mockClient,
  };
});

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('aws-amplify/storage', () => ({
  getUrl: vi.fn(),
}));

const { __mockClient: mockClient } = (await import('aws-amplify/data')) as unknown as {
  __mockClient: {
    models: {
      Visit: {
        get: ReturnType<typeof vi.fn>;
        list: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      VisitEdit: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };
};

const { getCurrentUser: mockGetCurrentUser } = (await import('aws-amplify/auth')) as unknown as {
  getCurrentUser: ReturnType<typeof vi.fn>;
};

const { getUrl: mockGetUrl } = (await import('aws-amplify/storage')) as unknown as {
  getUrl: ReturnType<typeof vi.fn>;
};

function buildVisitRecord(overrides: Record<string, unknown> = {}) {
  return {
    visitId: 'visit-001',
    cowId: '0123456789',
    datetime: '2026-03-01T00:00:00.000Z',
    status: 'COMPLETED',
    extractorModelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    extractedJson: JSON.stringify({
      vital: { temp_c: 39.5 },
      s: '食欲不振',
      o: '体温39.5',
      a: [],
      p: [],
    }),
    ...overrides,
  };
}

describe('VisitEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.models.Visit.get.mockResolvedValue({ data: buildVisitRecord(), errors: null });
    mockClient.models.Visit.list.mockResolvedValue({ data: [], errors: null });
    mockClient.models.Visit.update.mockResolvedValue({ errors: null });
    mockClient.models.VisitEdit.create.mockResolvedValue({ errors: null });
    mockGetCurrentUser.mockResolvedValue({ userId: 'editor-001', username: 'editor-001' });
    mockGetUrl.mockResolvedValue({
      url: new URL('https://example.com/audio'),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('edit-uuid-001');
  });

  it('loads signed audio URL for native audio controls when audioKey exists', async () => {
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({ audioKey: 'audio/test-cow/123.webm' }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);
    await screen.findByText('Audio Recording');

    await waitFor(() => {
      expect(mockGetUrl).toHaveBeenCalledWith({
        path: 'audio/test-cow/123.webm',
        options: {
          validateObjectExistence: true,
          expiresIn: 3600,
        },
      });
    });

    const audio = document.querySelector('audio') as HTMLAudioElement | null;
    expect(audio).not.toBeNull();
    expect(audio!.src).toContain('https://example.com/audio');
  });

  it('refreshes signed URL when visit audioKey changes', async () => {
    mockClient.models.Visit.get.mockImplementation(({ visitId }: { visitId: string }) => {
      if (visitId === 'visit-002') {
        return Promise.resolve({
          data: buildVisitRecord({
            visitId: 'visit-002',
            audioKey: 'audio/test-cow/next.webm',
          }),
          errors: null,
        });
      }
      return Promise.resolve({
        data: buildVisitRecord({
          visitId: 'visit-001',
          audioKey: 'audio/test-cow/123.webm',
        }),
        errors: null,
      });
    });

    mockGetUrl.mockImplementation(({ path }: { path: string }) =>
      Promise.resolve({
        url: new URL(`https://example.com/signed/${encodeURIComponent(path)}`),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      })
    );

    const { rerender } = render(<VisitEditor visitId="visit-001" />);
    await screen.findByText('Audio Recording');

    await waitFor(() => {
      expect(mockGetUrl).toHaveBeenCalledWith({
        path: 'audio/test-cow/123.webm',
        options: {
          validateObjectExistence: true,
          expiresIn: 3600,
        },
      });
    });

    rerender(<VisitEditor visitId="visit-002" />);

    await waitFor(() => {
      expect(mockGetUrl).toHaveBeenCalledWith({
        path: 'audio/test-cow/next.webm',
        options: {
          validateObjectExistence: true,
          expiresIn: 3600,
        },
      });
    });

    await waitFor(() => {
      const audio = document.querySelector('audio') as HTMLAudioElement | null;
      expect(audio).not.toBeNull();
      expect(audio!.src).toContain('audio%2Ftest-cow%2Fnext.webm');
    });
  });

  it('normalizes incomplete extractedJson payloads before rendering fields', async () => {
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({
        extractedJson: JSON.stringify({
          s: '元気がない',
          a: [{ name: '肺炎疑い' }],
          p: [{ name: '輸液', type: 'procedure' }],
        }),
      }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);

    await screen.findByText('Visit Edit');
    const tempInput = screen.getByLabelText('Body Temperature (°C)') as HTMLInputElement;
    const heartRateInput = screen.getByLabelText('Heart Rate (bpm)') as HTMLInputElement;
    const respRateInput = screen.getByLabelText('Respiratory Rate (bpm)') as HTMLInputElement;
    expect(tempInput.value).toBe('');
    expect(heartRateInput.value).toBe('');
    expect(respRateInput.value).toBe('');
    expect(screen.getByDisplayValue('元気がない')).toBeInTheDocument();
    expect(screen.getByText('肺炎疑い')).toBeInTheDocument();
    expect(screen.getByText('輸液')).toBeInTheDocument();
  });

  it('falls back to editable empty template when extractedJson is invalid', async () => {
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({
        extractedJson: JSON.stringify(12345),
      }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);

    await screen.findByText('Visit Edit');
    expect(
      screen.getByText(/Loaded an empty editable template/i)
    ).toBeInTheDocument();
    const tempInput = screen.getByLabelText('Body Temperature (°C)') as HTMLInputElement;
    expect(tempInput.value).toBe('');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('handles double-stringified extractedJson payloads', async () => {
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({
        extractedJson: JSON.stringify(
          JSON.stringify({
            vital: { temp_c: 39.2, heart_rate_bpm: 76, resp_rate_bpm: 24 },
            s: '食欲なし',
            o: '削痩あり',
            a: [{ name: 'ケトーシス' }],
            p: [],
          })
        ),
      }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);

    await screen.findByText('Visit Edit');
    expect((screen.getByLabelText('Body Temperature (°C)') as HTMLInputElement).value).toBe('39.2');
    expect((screen.getByLabelText('Heart Rate (bpm)') as HTMLInputElement).value).toBe('76');
    expect((screen.getByLabelText('Respiratory Rate (bpm)') as HTMLInputElement).value).toBe(
      '24'
    );
    expect(screen.getByDisplayValue('食欲なし')).toBeInTheDocument();
    expect(screen.getByDisplayValue('削痩あり')).toBeInTheDocument();
  });

  it('saves Visit and writes edit history with draft/corrected/diff metadata', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<VisitEditor visitId="visit-001" onSaved={onSaved} />);
    await screen.findByText('Visit Edit');

    const textareas = screen.getAllByRole('textbox');
    const heartRateInput = screen.getByLabelText('Heart Rate (bpm)');
    await user.clear(textareas[0]);
    await user.type(textareas[0], '食欲不振が継続');
    await user.type(heartRateInput, '68');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockClient.models.Visit.update).toHaveBeenCalledOnce();
      expect(mockClient.models.VisitEdit.create).toHaveBeenCalledOnce();
      expect(onSaved).toHaveBeenCalledOnce();
    });

    const updateArg = mockClient.models.Visit.update.mock.calls[0][0];
    expect(updateArg.visitId).toBe('visit-001');
    expect(typeof updateArg.extractedJson).toBe('string');
    expect(JSON.parse(updateArg.extractedJson).s).toBe('食欲不振が継続');
    expect(JSON.parse(updateArg.extractedJson).vital.heart_rate_bpm).toBe(68);

    const editArg = mockClient.models.VisitEdit.create.mock.calls[0][0];
    expect(editArg).toMatchObject({
      editId: 'edit-uuid-001',
      visitId: 'visit-001',
      caseId: 'visit-001',
      cowId: '0123456789',
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      editorId: 'editor-001',
    });
    expect(JSON.parse(editArg.llmDraftJson).s).toBe('食欲不振');
    expect(JSON.parse(editArg.humanCorrectedJson).s).toBe('食欲不振が継続');
    expect(typeof editArg.diffJsonPatch).toBe('string');
    expect(
      JSON.parse(editArg.diffJsonPatch).some(
        (op: { op: string; path: string }) => op.op === 'replace' && op.path === '/s'
      )
    ).toBe(true);
    expect(typeof editArg.editDurationSec === 'number' || editArg.editDurationSec === null).toBe(
      true
    );
  });

  it('falls back to unknown editor/model metadata when unavailable', async () => {
    const user = userEvent.setup();
    mockGetCurrentUser.mockRejectedValue(new Error('not logged in'));
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({ extractorModelId: null }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);
    await screen.findByText('Visit Edit');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockClient.models.VisitEdit.create).toHaveBeenCalledOnce();
    });

    const editArg = mockClient.models.VisitEdit.create.mock.calls[0][0];
    expect(editArg.modelId).toBe('unknown');
    expect(editArg.editorId).toBe('unknown');
  });

  it('sanitizes JSON payload before VisitEdit.create', async () => {
    const user = userEvent.setup();
    mockClient.models.Visit.get.mockResolvedValue({
      data: buildVisitRecord({
        extractedJson: JSON.stringify({
          vital: { temp_c: 39.4 },
          s: '軽度元気消失',
          o: '体温39.4',
          a: [{ name: '食滞疑い' }],
          p: [{ name: '輸液', type: 'procedure' }],
        }),
      }),
      errors: null,
    });

    render(<VisitEditor visitId="visit-001" />);
    await screen.findByText('Visit Edit');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockClient.models.VisitEdit.create).toHaveBeenCalledOnce();
    });

    const editArg = mockClient.models.VisitEdit.create.mock.calls[0][0];
    const llmDraftJson = JSON.parse(editArg.llmDraftJson);
    const humanCorrectedJson = JSON.parse(editArg.humanCorrectedJson);
    expect(Object.hasOwn(llmDraftJson.a[0], 'canonical_name')).toBe(false);
    expect(Object.hasOwn(llmDraftJson.p[0], 'dosage')).toBe(false);
    expect(Object.hasOwn(humanCorrectedJson.p[0], 'confidence')).toBe(false);
  });

  it('shows error when VisitEdit save fails and does not call onSaved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockClient.models.VisitEdit.create.mockResolvedValue({
      errors: [{ message: 'VisitEdit create failed' }],
    });

    render(<VisitEditor visitId="visit-001" onSaved={onSaved} />);
    await screen.findByText('Visit Edit');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(
      await screen.findByText(/Visit saved, but edit history save failed/i)
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('falls back to list query when Visit.get returns null', async () => {
    mockClient.models.Visit.get.mockResolvedValue({ data: null, errors: null });
    mockClient.models.Visit.list.mockResolvedValue({
      data: [buildVisitRecord({ visitId: 'visit-from-list' })],
      errors: null,
    });

    render(<VisitEditor visitId="visit-from-list" />);

    await screen.findByText('Visit Edit');
    expect(mockClient.models.Visit.list).toHaveBeenCalledWith({
      filter: { visitId: { eq: 'visit-from-list' } },
      limit: 1,
    });
    expect(screen.getByText('visit-from-list')).toBeInTheDocument();
  });

  it('shows backend errors when visit is not found', async () => {
    mockClient.models.Visit.get.mockResolvedValue({
      data: null,
      errors: [{ message: 'Unauthorized' }],
    });
    mockClient.models.Visit.list.mockResolvedValue({
      data: [],
      errors: [{ message: 'Access denied' }],
    });

    render(<VisitEditor visitId="visit-unauthorized" />);

    expect(await screen.findByText('Visit record not found.')).toBeInTheDocument();
    expect(screen.getByText(/Unauthorized/)).toBeInTheDocument();
    expect(screen.getByText(/Access denied/)).toBeInTheDocument();
  });
});
