import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCowLaunchUrl } from "../../src/lib/qr-links";
import { QRCodeDisplay } from "../../src/components/QRCodeDisplay";

const { mockToDataURL } = vi.hoisted(() => ({
  mockToDataURL: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: mockToDataURL,
  },
}));

describe("QRCodeDisplay", () => {
  const originalPrint = window.print;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToDataURL.mockResolvedValue("data:image/png;base64,stubbed-qr");
    window.print = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    window.print = originalPrint;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    console.error = originalConsoleError;
    document.querySelector("#qr-print-portal")?.remove();
  });

  it("renders a preview image from the launch URL payload", async () => {
    render(<QRCodeDisplay cowId="0123456789" onClose={vi.fn()} />);

    expect(mockToDataURL).toHaveBeenCalledWith(
      buildCowLaunchUrl("0123456789", window.location.origin),
      expect.objectContaining({
        width: 512,
        errorCorrectionLevel: "M",
      })
    );

    const previewImage = await screen.findByAltText("QR code for cow 0123456789");
    expect(previewImage).toHaveAttribute("src", "data:image/png;base64,stubbed-qr");
    expect(screen.getByText("ID:0123456789")).toBeInTheDocument();
  });

  it("shows a print-only portal and invokes window.print", async () => {
    render(<QRCodeDisplay cowId="0123456789" onClose={vi.fn()} />);

    await screen.findByAltText("QR code for cow 0123456789");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PRINT_QR" }));
    });

    await waitFor(() => {
      expect(window.print).toHaveBeenCalledTimes(1);
    });

    const printSheet = document.querySelector('[data-testid="qr-print-sheet"]');
    expect(printSheet).not.toBeNull();
    expect(screen.getByAltText("Printable QR code for cow 0123456789")).toHaveAttribute(
      "src",
      "data:image/png;base64,stubbed-qr"
    );

    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="qr-print-sheet"]')).toBeNull();
    });
  });

  it("shows an error and keeps printing disabled when QR generation fails", async () => {
    mockToDataURL.mockRejectedValueOnce(new Error("boom"));

    render(<QRCodeDisplay cowId="0123456789" onClose={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to generate QR code");
    expect(screen.getByRole("button", { name: "PRINT_QR" })).toBeDisabled();
    expect(window.print).not.toHaveBeenCalled();
  });
});
