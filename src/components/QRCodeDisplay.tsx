import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";

import { buildCowLaunchUrl } from "../lib/qr-links";
import { Button } from "./ui/Button/Button";

interface QRCodeDisplayProps {
  cowId: string;
  onClose: () => void;
}

const PRINT_PORTAL_ID = "qr-print-portal";
const QR_IMAGE_SIZE = 512;

export function QRCodeDisplay({ cowId, onClose }: QRCodeDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [printRoot, setPrintRoot] = useState<HTMLElement | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const setQrGenerationError = useCallback((context: string, err: unknown) => {
    console.error(context, err);
    setError("QRコードの生成に失敗しました");
    setLoading(false);
  }, []);

  useEffect(() => {
    const portalRoot = document.createElement("div");
    portalRoot.id = PRINT_PORTAL_ID;
    document.body.appendChild(portalRoot);
    setPrintRoot(portalRoot);

    return () => {
      portalRoot.remove();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setQrDataUrl(null);

    try {
      const launchUrl = buildCowLaunchUrl(cowId, window.location.origin);
      QRCode.toDataURL(launchUrl, {
        width: QR_IMAGE_SIZE,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      })
        .then((dataUrl) => {
          if (isCancelled) {
            return;
          }
          setQrDataUrl(dataUrl);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (isCancelled) {
            return;
          }
          setQrGenerationError("Failed to generate QR code (toDataURL):", err);
        });
    } catch (err: unknown) {
      setQrGenerationError("Failed to generate QR code (buildCowLaunchUrl or setup):", err);
    }

    return () => {
      isCancelled = true;
    };
  }, [cowId, setQrGenerationError]);

  useEffect(() => {
    if (!isPrinting || !qrDataUrl) {
      return;
    }

    let frameId = 0;
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };

    window.addEventListener("afterprint", handleAfterPrint);
    frameId = window.requestAnimationFrame(() => {
      window.print();
    });

    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isPrinting, qrDataUrl]);

  const handlePrint = useCallback(() => {
    if (loading || error || !qrDataUrl) {
      return;
    }
    setError(null);
    setIsPrinting(true);
  }, [error, loading, qrDataUrl]);

  return (
    <>
      <style>{`
        #${PRINT_PORTAL_ID} {
          display: none;
        }

        @media print {
          @page {
            margin: 12mm;
          }

          #root {
            display: none !important;
          }

          #${PRINT_PORTAL_ID} {
            display: block !important;
          }

          #${PRINT_PORTAL_ID} .qr-print-sheet {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 16px !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 auto !important;
            text-align: center !important;
            background: #ffffff !important;
          }

          #${PRINT_PORTAL_ID} .qr-print-frame {
            padding: 16px !important;
            border: 1px solid #000000 !important;
            background: #ffffff !important;
          }

          #${PRINT_PORTAL_ID} .qr-print-image {
            display: block !important;
            width: 320px !important;
            height: 320px !important;
          }
        }
      `}</style>

      <div
        className="qr-preview-area"
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

        <div className="qr-print-frame" style={{
          padding: "1rem",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-sm)",
          display: loading || error ? "none" : "block"
        }}>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`QR code for cow ${cowId}`}
              style={{ display: "block", width: "256px", height: "256px" }}
            />
          )}
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
            onClick={handlePrint}
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

      {printRoot && qrDataUrl && isPrinting
        ? createPortal(
            <div className="qr-print-sheet" data-testid="qr-print-sheet">
              <div className="qr-print-frame">
                <img
                  className="qr-print-image"
                  src={qrDataUrl}
                  alt={`Printable QR code for cow ${cowId}`}
                  width={320}
                  height={320}
                />
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "18px",
                  fontWeight: "bold",
                  letterSpacing: "0.04em",
                  color: "#000000",
                }}
              >
                ID:{cowId}
              </p>
            </div>,
            printRoot
          )
        : null}
    </>
  );
}
