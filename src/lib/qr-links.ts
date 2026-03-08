export const PENDING_QR_COW_ID_STORAGE_KEY = "vetvoice.pendingQrCowId";

function normalizeNonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMaybeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    if (!/^[/?#]/u.test(value)) {
      return null;
    }

    try {
      return new URL(value, "https://placeholder.invalid");
    } catch {
      return null;
    }
  }
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = normalizeNonEmpty(value);
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/u, "");
}

export function getPublicAppUrl(
  currentOrigin: string,
  configuredBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL
): string {
  const resolved = normalizeBaseUrl(configuredBaseUrl) ?? normalizeBaseUrl(currentOrigin);
  if (!resolved) {
    throw new Error("A public app URL could not be resolved.");
  }
  return resolved;
}

export function buildCowLaunchUrl(
  cowId: string,
  currentOrigin: string,
  configuredBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL
): string {
  const normalizedCowId = normalizeNonEmpty(cowId);
  if (!normalizedCowId) {
    throw new Error("cowId is required to build a QR launch URL.");
  }

  const url = new URL(getPublicAppUrl(currentOrigin, configuredBaseUrl));
  url.searchParams.set("cowId", normalizedCowId);
  return url.toString();
}

export function getCowIdFromSearch(search: string): string | null {
  return normalizeNonEmpty(new URLSearchParams(search).get("cowId"));
}

export function extractCowIdFromQrPayload(payload: string): string | null {
  const normalizedPayload = normalizeNonEmpty(payload);
  if (!normalizedPayload) {
    return null;
  }

  const parsedUrl = parseMaybeUrl(normalizedPayload);
  if (parsedUrl) {
    return getCowIdFromSearch(parsedUrl.search);
  }

  return normalizedPayload;
}

export function readPendingQrCowId(storage: Pick<Storage, "getItem"> | undefined): string | null {
  if (!storage) return null;

  try {
    return normalizeNonEmpty(storage.getItem(PENDING_QR_COW_ID_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistPendingQrCowId(
  cowId: string,
  storage: Pick<Storage, "setItem"> | undefined
): void {
  if (!storage) return;
  const normalizedCowId = normalizeNonEmpty(cowId);
  if (!normalizedCowId) return;

  try {
    storage.setItem(PENDING_QR_COW_ID_STORAGE_KEY, normalizedCowId);
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }
}

export function clearPendingQrCowId(storage: Pick<Storage, "removeItem"> | undefined): void {
  if (!storage) return;

  try {
    storage.removeItem(PENDING_QR_COW_ID_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }
}

export function clearCowIdQueryFromHref(href: string): string {
  const url = new URL(href, "https://placeholder.invalid");
  url.searchParams.delete("cowId");
  const nextSearch = url.searchParams.toString();
  return `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
}
