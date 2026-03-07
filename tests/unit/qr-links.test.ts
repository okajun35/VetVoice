import { describe, expect, it } from 'vitest';
import {
  buildCowLaunchUrl,
  clearCowIdQueryFromHref,
  extractCowIdFromQrPayload,
  getCowIdFromSearch,
  getPublicAppUrl,
} from '../../src/lib/qr-links';

describe('qr-links', () => {
  it('prefers configured public app URL for printed QR links', () => {
    expect(getPublicAppUrl('https://localhost:5173', 'https://app.example.com/')).toBe(
      'https://app.example.com'
    );
  });

  it('falls back to current origin when no public app URL is configured', () => {
    expect(buildCowLaunchUrl('0123456789', 'https://localhost:5173', '')).toBe(
      'https://localhost:5173/?cowId=0123456789'
    );
  });

  it('extracts cowId from QR launch URLs', () => {
    expect(
      extractCowIdFromQrPayload('https://app.example.com/?cowId=0123456789')
    ).toBe('0123456789');
  });

  it('keeps backward compatibility for legacy raw cowId QR payloads', () => {
    expect(extractCowIdFromQrPayload('0123456789')).toBe('0123456789');
  });

  it('rejects URL payloads that do not include cowId', () => {
    expect(extractCowIdFromQrPayload('https://app.example.com/?visitId=abc')).toBeNull();
  });

  it('reads cowId from location search', () => {
    expect(getCowIdFromSearch('?cowId=0123456789')).toBe('0123456789');
  });

  it('removes only cowId from the current URL', () => {
    expect(
      clearCowIdQueryFromHref('https://app.example.com/?cowId=0123456789&mode=scan#top')
    ).toBe('/?mode=scan#top');
  });
});
