/**
 * Feature: cow-management-qr, Property 4: QR code round-trip
 *
 * Validates: Requirements 5.1, 5.5
 *
 * For any valid cowId (10-digit numeric string), encoding the launch URL with
 * the `qrcode` library produces a valid output without error, ensuring printed
 * QR codes can open the application directly.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import QRCode from "qrcode";
import { buildCowLaunchUrl, extractCowIdFromQrPayload } from "../../src/lib/qr-links";
import { cowIdArb } from "../helpers/generators";

describe("Feature: cow-management-qr, Property 4: QR code round-trip", () => {
  it("any valid launch URL encodes to a data URL without error", async () => {
    await fc.assert(
      fc.asyncProperty(cowIdArb, async (cowId) => {
        const launchUrl = buildCowLaunchUrl(cowId, "https://app.example.com");
        const dataUrl = await QRCode.toDataURL(launchUrl, {
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

  it("any valid launch URL encodes to a UTF-8 string representation without error", async () => {
    await fc.assert(
      fc.asyncProperty(cowIdArb, async (cowId) => {
        const launchUrl = buildCowLaunchUrl(cowId, "https://app.example.com");
        const result = await QRCode.toString(launchUrl, { type: "utf8" });
        // Must resolve to a non-empty string
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it("any generated launch URL decodes back to the original cowId payload", async () => {
    await fc.assert(
      fc.property(cowIdArb, (cowId) => {
        const launchUrl = buildCowLaunchUrl(cowId, "https://app.example.com");
        expect(extractCowIdFromQrPayload(launchUrl)).toBe(cowId);
      }),
      { numRuns: 100 }
    );
  });
});
