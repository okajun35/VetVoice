import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadData } from 'aws-amplify/storage';

interface VoiceRecorderProps {
  cowId: string;
  onUploadComplete: (audioKey: string) => void;
  onError?: (error: string) => void;
}

type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

export function VoiceRecorder({ cowId, onUploadComplete, onError }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  useEffect(() => {
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    setElapsed(0);
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
      handleError('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      const key = `audio/${cowId}/${Date.now()}.webm`;

      setState('uploading');
      try {
        await uploadData({
          path: key,
          data: blob,
          options: { contentType: mimeType || 'audio/webm' },
        }).result;
        setState('done');
        onUploadComplete(key);
      } catch {
        handleError('音声ファイルのアップロードに失敗しました。再度お試しください。');
      }
    };

    recorder.onerror = () => {
      stopTimer();
      handleError('録音中にエラーが発生しました。');
    };

    recorder.start(250);
    setState('recording');
    startTimer();
  };

  const stopRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  };

  const reset = () => {
    setState('idle');
    setElapsed(0);
    setErrorMessage(null);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isSupported) {
    return (
      <div className="voice-recorder voice-recorder--unsupported">
        <p>このブラウザは音声録音に対応していません。Chrome または Safari をご利用ください。</p>
      </div>
    );
  }

  return (
    <div className="voice-recorder">
      {state === 'recording' && (
        <div className="voice-recorder__indicator">
          <span className="voice-recorder__dot" aria-hidden="true" />
          <span>録音中 — {formatTime(elapsed)}</span>
        </div>
      )}

      {state === 'uploading' && (
        <div className="voice-recorder__status">アップロード中...</div>
      )}

      {state === 'done' && (
        <div className="voice-recorder__status voice-recorder__status--done">
          アップロード完了
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className="voice-recorder__error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="voice-recorder__controls">
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <button
            type="button"
            className="voice-recorder__btn voice-recorder__btn--start"
            onClick={state === 'idle' ? startRecording : reset}
          >
            {state === 'idle' ? '録音開始' : 'もう一度録音'}
          </button>
        )}

        {state === 'recording' && (
          <button
            type="button"
            className="voice-recorder__btn voice-recorder__btn--stop"
            onClick={stopRecording}
          >
            録音停止
          </button>
        )}
      </div>
    </div>
  );
}
