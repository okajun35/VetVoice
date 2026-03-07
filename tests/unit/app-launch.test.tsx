import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../../src/App';
import { PENDING_QR_COW_ID_STORAGE_KEY } from '../../src/lib/qr-links';

const { mockClient, mockSignOut } = vi.hoisted(() => ({
  mockClient: {
    models: {
      Cow: {
        get: vi.fn(),
      },
    },
  },
  mockSignOut: vi.fn(),
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockClient,
}));

vi.mock('aws-amplify/utils', () => ({
  I18n: {
    putVocabularies: vi.fn(),
    setLanguage: vi.fn(),
  },
}));

vi.mock('@aws-amplify/ui-react', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  createTheme: () => ({}),
  Authenticator: ({
    children,
  }: {
    children: (props: {
      signOut: typeof mockSignOut;
      user: { signInDetails: { loginId: string } };
    }) => ReactNode;
  }) => <>{children({ signOut: mockSignOut, user: { signInDetails: { loginId: 'vet@example.com' } } })}</>,
}));

vi.mock('../../src/components/QRScanner', () => ({
  QRScanner: () => <div data-testid="qr-scanner">qr-scanner</div>,
}));

vi.mock('../../src/components/CowRegistrationForm', () => ({
  CowRegistrationForm: () => <div data-testid="cow-registration-form">cow-registration-form</div>,
}));

vi.mock('../../src/components/VisitManager', () => ({
  VisitManager: ({ cowId }: { cowId: string }) => (
    <div data-testid="visit-manager">visit-manager:{cowId}</div>
  ),
}));

vi.mock('../../src/components/CowListScreen', () => ({
  CowListScreen: () => <div data-testid="cow-list-screen">cow-list-screen</div>,
}));

vi.mock('../../src/components/DevEntryPoints', () => ({
  default: () => <div data-testid="dev-entry-points">dev-entry-points</div>,
}));

describe('App QR URL launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    mockClient.models.Cow.get.mockReset();
  });

  it('opens VisitManager when a printed QR launch URL matches a registered cow', async () => {
    mockClient.models.Cow.get.mockResolvedValue({
      data: { cowId: '0123456789' },
      errors: null,
    });
    window.history.replaceState({}, '', '/?cowId=0123456789');

    render(<App />);

    await waitFor(() => {
      expect(mockClient.models.Cow.get).toHaveBeenCalledWith({ cowId: '0123456789' });
    });

    expect(await screen.findByTestId('visit-manager')).toHaveTextContent(
      'visit-manager:0123456789'
    );
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(PENDING_QR_COW_ID_STORAGE_KEY)).toBeNull();
  });

  it('returns to the top screen with a warning when the QR cow is not registered', async () => {
    mockClient.models.Cow.get.mockResolvedValue({
      data: null,
      errors: null,
    });
    window.history.replaceState({}, '', '/?cowId=0000000000');

    render(<App />);

    await waitFor(() => {
      expect(mockClient.models.Cow.get).toHaveBeenCalledWith({ cowId: '0000000000' });
    });

    expect(await screen.findByTestId('qr-scanner')).toBeInTheDocument();
    expect(
      screen.getByText('登録されていない個体です。トップ画面から登録してください。')
    ).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(PENDING_QR_COW_ID_STORAGE_KEY)).toBeNull();
  });
});
