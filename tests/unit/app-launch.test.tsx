import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import App from '../../src/App';
import { PENDING_QR_COW_ID_STORAGE_KEY } from '../../src/lib/qr-links';

const { mockClient, mockQrScannerMounted, mockSignOut } = vi.hoisted(() => ({
  mockClient: {
    models: {
      Cow: {
        get: vi.fn(),
      },
    },
  },
  mockQrScannerMounted: vi.fn(),
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
  QRScanner: () => {
    useEffect(() => {
      mockQrScannerMounted();
    }, []);

    return <div data-testid="qr-scanner">qr-scanner</div>;
  },
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
      screen.getByText('Cow not found. Please register from the top page.')
    ).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(PENDING_QR_COW_ID_STORAGE_KEY)).toBeNull();
  });

  it('returns to the top screen when the header logo is clicked', async () => {
    mockClient.models.Cow.get.mockResolvedValue({
      data: { cowId: '0123456789' },
      errors: null,
    });
    window.history.replaceState({}, '', '/?cowId=0123456789');

    render(<App />);

    expect(await screen.findByTestId('visit-manager')).toHaveTextContent(
      'visit-manager:0123456789'
    );
    const mountsBeforeReturn = mockQrScannerMounted.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Go to top page' }));

    expect(await screen.findByTestId('qr-scanner')).toBeInTheDocument();
    expect(screen.queryByTestId('visit-manager')).not.toBeInTheDocument();
    expect(mockQrScannerMounted.mock.calls.length).toBeGreaterThan(mountsBeforeReturn);
  });

  it('remounts the QR scanner when the header logo is clicked on the top screen', async () => {
    render(<App />);

    expect(await screen.findByTestId('qr-scanner')).toBeInTheDocument();
    expect(mockQrScannerMounted).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Go to top page' }));

    await waitFor(() => {
      expect(mockQrScannerMounted).toHaveBeenCalledTimes(2);
    });
  });
});
