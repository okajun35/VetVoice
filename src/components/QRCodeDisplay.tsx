import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { Button } from "./ui/Button/Button";

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
      color: {
        dark: "#C6FF00",
        light: "#121212",
      },
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
            background: white !important;
          }
          .qr-print-area * { color: black !important; }
        }
      `}</style>

      <div
        className="qr-print-area"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "1rem",
        }}
      >
        <h2 style={{
          margin: 0,
          fontFamily: "var(--font-family-display)",
          fontSize: "var(--font-size-2xl)",
          color: "var(--color-primary)",
          letterSpacing: "0.1em"
        }}>
          QR_GEN_SUCCESS
        </h2>

        {error && (
          <div
            role="alert"
            style={{
              padding: "1rem",
              background: "rgba(255, 87, 34, 0.1)",
              border: "1px solid var(--color-danger)",
              borderLeft: "4px solid var(--color-danger)",
              color: "var(--color-danger)",
              fontFamily: "var(--font-family-mono)",
              fontSize: "var(--font-size-sm)"
            }}
          >
            {error}
          </div>
        )}

        <div style={{
          padding: "1rem",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-sm)",
          display: loading || error ? "none" : "block"
        }}>
          <canvas ref={canvasRef} />
        </div>

        {loading && (
          <p style={{ fontFamily: "var(--font-family-mono)", color: "var(--color-text-tertiary)" }}>
            GENERATING_MATRIX...
          </p>
        )}

        <p style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "var(--font-size-lg)",
          margin: 0,
          color: "var(--color-primary)",
          fontWeight: "bold",
          letterSpacing: "0.05em"
        }}>
          ID:{cowId}
        </p>

        <div
          className="no-print"
          style={{ display: "flex", gap: "1rem", marginTop: "1rem", width: "100%" }}
        >
          <Button
            variant="primary"
            onClick={() => window.print()}
            disabled={loading || !!error}
            fullWidth
          >
            PRINT_QR
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            fullWidth
          >
            CLOSE
          </Button>
        </div>
      </div>
    </>
  );
}
