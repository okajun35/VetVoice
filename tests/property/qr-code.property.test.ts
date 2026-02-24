/**
 * Feature: cow-management-qr, Property 4: QR code round-trip
 *
 * Validates: Requirements 5.1, 5.5
 *
 * For any valid cowId (10-digit numeric string), encoding with the `qrcode`
 * library produces a valid output without error, ensuring compatibility with
 * the existing QRScanner component.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import QRCode from "qrcode";
import { cowIdArb } from "../helpers/generators";

describe("Feature: cow-management-qr, Property 4: QR code round-trip", () => {
  it("any valid cowId encodes to a data URL without error", async () => {
    await fc.assert(
      fc.asyncProperty(cowIdArb, async (cowId) => {
        const dataUrl = await QRCode.toDataURL(cowId, {
          errorCorrectionLevel: "M",
          width: 256,
        });
        // Must resolve to a non-empty data URL string
        expect(typeof dataUrl).toBe("string");
        expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
        expect(dataUrl.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it("any valid cowId encodes to a UTF-8 string representation without error", async () => {
    await fc.assert(
      fc.asyncProperty(cowIdArb, async (cowId) => {
        const result = await QRCode.toString(cowId, { type: "utf8" });
        // Must resolve to a non-empty string
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
