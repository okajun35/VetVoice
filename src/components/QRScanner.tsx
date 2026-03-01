/**
 * QRScanner component
 *
 * Uses Html5Qrcode low-level API (not Html5QrcodeScanner) to avoid
 * React StrictMode double-mount issues and removeChild DOM conflicts.
 *
 * Requirements: 1.1, 1.2, 1.3, 19.1
 */
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, type CameraDevice } from 'html5-qrcode';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Button } from './ui/Button/Button';
import { Spinner } from './ui/Spinner/Spinner';
import styles from './QRScanner.module.css';

const client = generateClient<Schema>();

interface QRScannerProps {
  onCowFound: (cowId: string) => void;
  onNewCow: (cowId: string) => void;
}

type ScannerState = 'idle' | 'scanning' | 'loading' | 'error';

const SCANNER_ELEMENT_ID = 'qr-reader';

export function QRScanner({ onCowFound, onNewCow }: QRScannerProps) {
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedCowId, setScannedCowId] = useState<string | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const processedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        setCameras(devices);
        if (devices.length > 0) {
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage('カメラへのアクセスに失敗しました。ブラウザの権限設定を確認してください。');
        setScannerState('error');
      });

    html5QrcodeRef.current = new Html5Qrcode(SCANNER_ELEMENT_ID);

    return () => {
      cancelled = true;
      if (isRunningRef.current && html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => { });
        isRunningRef.current = false;
      }
      html5QrcodeRef.current = null;
    };
  }, []);

  const startScanning = async (cameraId: string) => {
    const scanner = html5QrcodeRef.current;
    if (!scanner || isRunningRef.current) return;

    processedRef.current = false;
    setScannerState('scanning');
    setErrorMessage(null);

    try {
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processedRef.current) return;
          processedRef.current = true;

          try {
            await scanner.stop();
            isRunningRef.current = false;
          } catch {
            // ignore stop errors
          }

          const cowId = decodedText.trim();
          setScannedCowId(cowId);
          setScannerState('loading');

          try {
            const { data: cow, errors } = await client.models.Cow.get({ cowId });
            if (errors && errors.length > 0) {
              setErrorMessage('牛情報の取得中にエラーが発生しました。再度お試しください。');
              setScannerState('error');
              return;
            }
            if (cow) {
              onCowFound(cowId);
            } else {
              onNewCow(cowId);
            }
          } catch {
            setErrorMessage('ネットワークエラーが発生しました。接続を確認して再度お試しください。');
            setScannerState('error');
          }
        },
        () => { }
      );
      isRunningRef.current = true;
    } catch {
      isRunningRef.current = false;
      setErrorMessage('カメラの起動に失敗しました。別のカメラを選択するか、権限を確認してください。');
      setScannerState('error');
    }
  };

  const handleStart = () => {
    if (selectedCameraId) {
      startScanning(selectedCameraId);
    }
  };

  const handleStop = async () => {
    const scanner = html5QrcodeRef.current;
    if (scanner && isRunningRef.current) {
      await scanner.stop().catch(() => { });
      isRunningRef.current = false;
    }
    setScannerState('idle');
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setScannedCowId(null);
    setScannerState('idle');
  };

  return (
    <div className={styles.scanner}>
      <h2 className={styles.title}>QR_SCANNER</h2>
      <p className={styles.description}>
        POSITION_ID_TAG_OR_QR_CODE_WITHIN_VIEWPORT_FOR_DIAGNOSTIC_ENTRY
      </p>

      {/* Camera viewport — always in DOM so Html5Qrcode can bind to it */}
      <div
        id={SCANNER_ELEMENT_ID}
        className={styles.reader}
        style={{ display: scannerState === 'scanning' ? 'block' : 'none' }}
      />

      {scannerState === 'idle' && (
        <div className={styles.controls}>
          {cameras.length > 1 && (
            <div className={styles.cameraSelect}>
              <label htmlFor="camera-select">DEVICE_SELECT:</label>
              <select
                id="camera-select"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label?.toUpperCase() || `CAMERA_${cam.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button
            type="button"
            onClick={handleStart}
            disabled={!selectedCameraId}
            variant="primary"
            size="xl"
            fullWidth
          >
            INITIATE_SCAN
          </Button>
        </div>
      )}

      {scannerState === 'scanning' && (
        <div className={styles.controls}>
          <Button
            type="button"
            onClick={handleStop}
            variant="secondary"
            size="xl"
            fullWidth
          >
            TERMINATE_SCAN
          </Button>
        </div>
      )}

      {scannerState === 'loading' && (
        <div className={styles.status} aria-live="polite">
          <Spinner size="lg" />
          <p>
            FETCHING_DATABASE_RECORD...
            {scannedCowId && (
              <span className={styles.cowId}> [ID: {scannedCowId}]</span>
            )}
          </p>
        </div>
      )}

      {scannerState === 'error' && (
        <div className={styles.error} role="alert">
          <p className={styles.errorMessage}>
            {errorMessage?.toUpperCase() ?? 'SYSTEM_EXECUTION_FAILURE'}
          </p>
          <Button
            type="button"
            onClick={handleRetry}
            variant="primary"
            size="md"
            fullWidth
          >
            REBOOT_SCANNER
          </Button>
        </div>
      )}
    </div>
  );
}

export default QRScanner;
