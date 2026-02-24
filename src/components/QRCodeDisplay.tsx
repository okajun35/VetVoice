import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  cowId: string;
  onClose: () => void;
}

export function QRCodeDisplay({ cowId, onClose }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    setLoading(true);
    setError(null);
    QRCode.toCanvas(canvasRef.current, cowId, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(() => setLoading(false))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "QRコードの生成に失敗しました");
        setLoading(false);
      });
  }, [cowId]);

  return (
    <>
      <style>{`
        @media print {
          body > *:not(.qr-print-area) { display: none; }
          .qr-print-area {
            display: block !important;
            text-align: center;
            padding: 2rem;
          }
        }
      `}</style>

      <div
        className="qr-print-area"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>QRコード</h2>

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.75rem",
              background: "#fff0f0",
              border: "1px solid #cc0000",
              borderRadius: "4px",
              color: "#cc0000",
            }}
          >
            {error}
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ display: loading || error ? "none" : "block" }}
        />

        {loading && <p>生成中...</p>}

        <p style={{ fontFamily: "monospace", fontSize: "1.1rem", margin: 0 }}>
          {cowId}
        </p>

        <div
          className="no-print"
          style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}
        >
          <button
            onClick={() => window.print()}
            disabled={loading || !!error}
            style={{
              padding: "0.5rem 1.25rem",
              cursor: loading || error ? "not-allowed" : "pointer",
            }}
          >
            印刷
          </button>
          <button
            onClick={onClose}
            style={{ padding: "0.5rem 1.25rem", cursor: "pointer" }}
          >
            閉じる
          </button>
        </div>
      </div>
    </>
  );
}
