/**
 * Offline queue & retry logic
 * Task 28.1: localStorage-based queue with exponential backoff retry
 * Requirements: 3.4, 3.6
 */

export interface QueueItem {
  id: string;
  type: string;
  payload: unknown;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
}

export interface OfflineQueueOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  storageKey?: string;
}

const DEFAULT_OPTIONS: Required<OfflineQueueOptions> = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  storageKey: 'vetvoice_offline_queue',
};

/**
 * localStorage-based offline queue with exponential backoff retry.
 * Falls back to in-memory storage when localStorage is unavailable (e.g., test environments).
 */
export class OfflineQueue {
  private readonly options: Required<OfflineQueueOptions>;
  private memoryFallback: QueueItem[] | null = null;

  constructor(options?: OfflineQueueOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Detect if localStorage is available; if not, use in-memory fallback
    if (!this._isLocalStorageAvailable()) {
      this.memoryFallback = [];
    }
  }

  private _isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__vetvoice_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private _load(): QueueItem[] {
    if (this.memoryFallback !== null) {
      return [...this.memoryFallback];
    }
    try {
      const raw = localStorage.getItem(this.options.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as QueueItem[];
    } catch {
      return [];
    }
  }

  private _save(items: QueueItem[]): void {
    if (this.memoryFallback !== null) {
      this.memoryFallback = [...items];
      return;
    }
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(items));
    } catch {
      // localStorage write failed (e.g., quota exceeded) - silently ignore
    }
  }

  /**
   * Add an item to the queue.
   */
  enqueue(type: string, payload: unknown): QueueItem {
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    const items = this._load();
    items.push(item);
    this._save(items);
    return item;
  }

  /**
   * Get all items in the queue.
   */
  getAll(): QueueItem[] {
    return this._load();
  }

  /**
   * Remove an item by id (call on success).
   */
  remove(id: string): void {
    const items = this._load().filter((item) => item.id !== id);
    this._save(items);
  }

  /**
   * Increment retry count for an item (call on failure).
   * Returns the updated item, or null if not found.
   */
  incrementRetry(id: string): QueueItem | null {
    const items = this._load();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    items[index] = {
      ...items[index],
      retryCount: items[index].retryCount + 1,
      lastAttemptAt: new Date().toISOString(),
    };
    this._save(items);
    return items[index];
  }

  /**
   * Get items that have exhausted all retries (retryCount >= maxRetries).
   */
  getExhausted(): QueueItem[] {
    return this._load().filter((item) => item.retryCount >= this.options.maxRetries);
  }

  /**
   * Remove all exhausted items from the queue.
   */
  removeExhausted(): void {
    const items = this._load().filter((item) => item.retryCount < this.options.maxRetries);
    this._save(items);
  }

  /**
   * Calculate the next retry delay in ms using exponential backoff.
   * delay = min(baseDelayMs * 2^retryCount, maxDelayMs)
   */
  getRetryDelay(item: QueueItem): number {
    const delay = this.options.baseDelayMs * Math.pow(2, item.retryCount);
    return Math.min(delay, this.options.maxDelayMs);
  }

  /**
   * Clear all items from the queue.
   */
  clear(): void {
    this._save([]);
  }

  /**
   * Return the number of items in the queue.
   */
  size(): number {
    return this._load().length;
  }
}

export default OfflineQueue;
