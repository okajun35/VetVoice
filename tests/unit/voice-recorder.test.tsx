import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { VoiceRecorder } from '../../src/components/VoiceRecorder';

vi.mock('aws-amplify/storage', () => {
  const mockUploadData = vi.fn();
  return {
    uploadData: mockUploadData,
    __mockUploadData: mockUploadData,
  };
});

const { __mockUploadData: mockUploadData } = await import(
  'aws-amplify/storage'
) as unknown as {
  __mockUploadData: ReturnType<typeof vi.fn>;
};

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  public state: 'inactive' | 'recording' = 'inactive';
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public onstop: (() => void | Promise<void>) | null = null;
  public onerror: (() => void) | null = null;

  stop = vi.fn(async () => {
    this.state = 'inactive';
    if (this.ondataavailable) {
      const data = this.nextChunk ?? new Blob(['audio'], { type: 'audio/webm' });
      this.ondataavailable({ data });
    }
    if (this.onstop) {
      await this.onstop();
    }
  });

  private nextChunk: Blob | null = null;

  start = vi.fn(() => {
    this.state = 'recording';
  });

  setChunk(chunk: Blob) {
    this.nextChunk = chunk;
  }
}

describe('VoiceRecorder', () => {
  let mediaRecorderInstance: MockMediaRecorder;
  const originalWindowMediaRecorder = Object.getOwnPropertyDescriptor(window, 'MediaRecorder');
  const originalNavigatorMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockUploadData.mockReturnValue({ result: Promise.resolve() });

    mediaRecorderInstance = new MockMediaRecorder();

    const MediaRecorderCtor = vi.fn(() => mediaRecorderInstance) as unknown as {
      new (...args: unknown[]): MockMediaRecorder;
      isTypeSupported: ReturnType<typeof vi.fn>;
    };
    MediaRecorderCtor.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MediaRecorderCtor);
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = MediaRecorderCtor;
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MediaRecorderCtor,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalWindowMediaRecorder) {
      Object.defineProperty(window, 'MediaRecorder', originalWindowMediaRecorder);
    } else {
      delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    }

    if (originalNavigatorMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalNavigatorMediaDevices);
    }
  });

  it('auto-stops recording at max duration and uploads audio', async () => {
    const onUploadComplete = vi.fn();

    render(
      <VoiceRecorder
        cowId="test-cow-001"
        onUploadComplete={onUploadComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(75_000);
      await Promise.resolve();
    });
    expect(screen.getByText('Recording stops automatically at 90 seconds')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mediaRecorderInstance.stop).toHaveBeenCalledTimes(1);
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
    expect(mockUploadData).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized audio blob before upload', async () => {
    const onError = vi.fn();

    mediaRecorderInstance.setChunk(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]));

    render(
      <VoiceRecorder
        cowId="test-cow-001"
        onUploadComplete={vi.fn()}
        onError={onError}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop Recording' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Audio file exceeds the size limit')
    );
    expect(mockUploadData).not.toHaveBeenCalled();
  });

  it('uses mp4/m4a when only mp4 recording is supported', async () => {
    const onUploadComplete = vi.fn();
    const getUserMediaMock = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    const MediaRecorderCtor = vi.fn(() => mediaRecorderInstance) as unknown as {
      new (...args: unknown[]): MockMediaRecorder;
      isTypeSupported: ReturnType<typeof vi.fn>;
    };
    MediaRecorderCtor.isTypeSupported = vi.fn((mimeType: string) => mimeType.includes('mp4'));
    vi.stubGlobal('MediaRecorder', MediaRecorderCtor);
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = MediaRecorderCtor;
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MediaRecorderCtor,
    });

    render(<VoiceRecorder cowId="test-cow-001" onUploadComplete={onUploadComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop Recording' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUploadData).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^audio\/test-cow-001\/\d+\.m4a$/),
        options: expect.objectContaining({
          contentType: expect.stringMatching(/^audio\/mp4/),
        }),
      })
    );
    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.stringMatching(/^audio\/test-cow-001\/\d+\.m4a$/)
    );
  });
});
