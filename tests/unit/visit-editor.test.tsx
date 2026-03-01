import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitEditor } from '../../src/components/VisitEditor';

vi.mock('aws-amplify/data', () => {
  const mockClient = {
    models: {
      Visit: {
        get: vi.fn(),
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

const { __mockClient: mockClient } = (await import('aws-amplify/data')) as unknown as {
  __mockClient: {
    models: {
      Visit: {
        get: ReturnType<typeof vi.fn>;
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
    mockClient.models.Visit.update.mockResolvedValue({ errors: null });
    mockClient.models.VisitEdit.create.mockResolvedValue({ errors: null });
    mockGetCurrentUser.mockResolvedValue({ userId: 'editor-001', username: 'editor-001' });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('edit-uuid-001');
  });

  it('saves Visit and writes edit history with draft/corrected/diff metadata', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<VisitEditor visitId="visit-001" onSaved={onSaved} />);
    await screen.findByText('診療記録編集');

    const textareas = screen.getAllByRole('textbox');
    await user.clear(textareas[0]);
    await user.type(textareas[0], '食欲不振が継続');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockClient.models.Visit.update).toHaveBeenCalledOnce();
      expect(mockClient.models.VisitEdit.create).toHaveBeenCalledOnce();
      expect(onSaved).toHaveBeenCalledOnce();
    });

    const updateArg = mockClient.models.Visit.update.mock.calls[0][0];
    expect(updateArg.visitId).toBe('visit-001');
    expect(typeof updateArg.extractedJson).toBe('string');
    expect(JSON.parse(updateArg.extractedJson).s).toBe('食欲不振が継続');

    const editArg = mockClient.models.VisitEdit.create.mock.calls[0][0];
    expect(editArg).toMatchObject({
      editId: 'edit-uuid-001',
      visitId: 'visit-001',
      caseId: 'visit-001',
      cowId: '0123456789',
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      editorId: 'editor-001',
    });
    expect(editArg.llmDraftJson.s).toBe('食欲不振');
    expect(editArg.humanCorrectedJson.s).toBe('食欲不振が継続');
    expect(Array.isArray(editArg.diffJsonPatch)).toBe(true);
    expect(
      editArg.diffJsonPatch.some(
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
    await screen.findByText('診療記録編集');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockClient.models.VisitEdit.create).toHaveBeenCalledOnce();
    });

    const editArg = mockClient.models.VisitEdit.create.mock.calls[0][0];
    expect(editArg.modelId).toBe('unknown');
    expect(editArg.editorId).toBe('unknown');
  });

  it('shows error when VisitEdit save fails and does not call onSaved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockClient.models.VisitEdit.create.mockResolvedValue({
      errors: [{ message: 'VisitEdit create failed' }],
    });

    render(<VisitEditor visitId="visit-001" onSaved={onSaved} />);
    await screen.findByText('診療記録編集');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(
      await screen.findByText(/修正履歴の保存に失敗しました/)
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
