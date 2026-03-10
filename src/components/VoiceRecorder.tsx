import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { Button } from './ui/Button/Button';
import { Spinner } from './ui/Spinner/Spinner';
import styles from './VoiceRecorder.module.css';

interface VoiceRecorderProps {
  cowId: string;
  onUploadComplete: (audioKey: string) => void;
  onError?: (error: string) => void;
}

type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

const MAX_RECORDING_SECONDS = 90;
const AUTO_STOP_WARNING_SECONDS = 75;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

interface RecorderFormat {
  mimeType: string | null;
  extension: 'webm' | 'ogg' | 'm4a';
  uploadContentType: string;
}

function isAppleBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
  return hasSafari || ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod');
}

function extensionFromMime(mimeType: string): RecorderFormat['extension'] {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

function resolveRecorderFormat(): RecorderFormat {
  const applePreferred = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  const standardPreferred = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
  ];
  const candidates = isAppleBrowser() ? applePreferred : standardPreferred;

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return {
        mimeType: candidate,
        extension: extensionFromMime(candidate),
        uploadContentType: candidate.split(';')[0],
      };
    }
  }

  return {
    mimeType: null,
    extension: 'webm',
    uploadContentType: 'audio/webm',
  };
}

export function VoiceRecorder({ cowId, onUploadComplete, onError }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoStopWarning, setAutoStopWarning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimer]);

  useEffect(() => {
    if (state !== 'recording') return;
    if (elapsed >= AUTO_STOP_WARNING_SECONDS && !autoStopWarning) {
      setAutoStopWarning(true);
    }
    if (elapsed >= MAX_RECORDING_SECONDS) {
      stopRecording();
    }
  }, [elapsed, autoStopWarning, state, stopRecording]);

  const startTimer = () => {
    setElapsed(0);
    setAutoStopWarning(false);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const handleError = useCallback(
    (msg: string) => {
      setErrorMessage(msg);
      setState('error');
      onError?.(msg);
    },
    [onError]
  );

  const startRecording = async () => {
    setErrorMessage(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handleError('Microphone access denied. Check your browser settings.');
      return;
    }

    streamRef.current = stream;

    const format = resolveRecorderFormat();

    const recorder = new MediaRecorder(stream, format.mimeType ? { mimeType: format.mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopTimer();

      const fallbackType = chunksRef.current[0]?.type || format.uploadContentType;
      const blob = new Blob(chunksRef.current, { type: format.mimeType ?? fallbackType });
      const recordedType = blob.type || fallbackType || format.uploadContentType;
      const extensionForKey =
        !format.mimeType || recordedType !== format.mimeType
          ? extensionFromMime(recordedType)
          : format.extension;
      if (blob.size > MAX_AUDIO_BYTES) {
        handleError(
          `Audio file exceeds the size limit (max ${(MAX_AUDIO_BYTES / (1024 * 1024)).toFixed(0)}MB).`
        );
        return;
      }
      const key = `audio/${cowId}/${Date.now()}.${extensionForKey}`;

      setState('uploading');
      try {
        await uploadData({
          path: key,
          data: blob,
          options: { contentType: recordedType || format.uploadContentType },
        }).result;
        setState('done');
        onUploadComplete(key);
      } catch {
        handleError('Failed to upload audio file. Please try again.');
      }
    };

    recorder.onerror = () => {
      stopTimer();
      handleError('An error occurred while recording.');
    };

    recorder.start(250);
    setState('recording');
    startTimer();
  };

  const reset = () => {
    setState('idle');
    setElapsed(0);
    setErrorMessage(null);
    setAutoStopWarning(false);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isSupported) {
    return (
      <div className={styles.container}>
        <div className={styles.unsupported}>
          <p>This browser does not support audio recording. Use Chrome or Safari.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {state === 'recording' && (
        <div className={styles.indicator}>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.indicatorLabel}>Recording In Progress</span>
          <span className={styles.timer}>{formatTime(elapsed)}</span>
        </div>
      )}
      {state === 'recording' && autoStopWarning && (
        <div className={styles.status} role="status" aria-live="polite">
          Recording stops automatically at {MAX_RECORDING_SECONDS} seconds
        </div>
      )}

      {state === 'uploading' && (
        <div className={styles.status}>
          <Spinner size="sm" label="DATA UPLOAD INITIATED..." />
        </div>
      )}

      {state === 'done' && (
        <div className={`${styles.status} ${styles.statusDone}`}>
          UPLOAD SEQUENCE COMPLETE
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className={styles.error} role="alert">
          CRITICAL ERROR: {errorMessage.toUpperCase()}
        </div>
      )}

      <div className={styles.controls}>
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <Button
            variant="primary"
            size="xl"
            onClick={state === 'idle' ? startRecording : reset}
            fullWidth
          >
            {state === 'idle' ? 'Start Recording' : 'Record Again'}
          </Button>
        )}

        {state === 'recording' && (
          <Button
            variant="danger"
            size="xl"
            onClick={stopRecording}
            fullWidth
          >
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  );
}
