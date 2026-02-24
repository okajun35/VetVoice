/**
 * Unit tests for OfflineQueue
 * Task 28.2: enqueue, remove, incrementRetry, getExhausted, removeExhausted, getRetryDelay, clear, size
 * Requirements: 3.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineQueue } from '../../src/lib/offline-queue';

// Use a unique storageKey per test suite to avoid cross-test pollution
function makeQueue(overrides?: ConstructorParameters<typeof OfflineQueue>[0]) {
  return new OfflineQueue({ storageKey: 'test_offline_queue', ...overrides });
}

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    queue = makeQueue();
    queue.clear();
  });

  // 1. enqueue() adds an item
  it('enqueue() adds an item to the queue', () => {
    expect(queue.size()).toBe(0);
    const item = queue.enqueue('runPipeline', { cowId: '0123456789' });
    expect(queue.size()).toBe(1);
    expect(item.type).toBe('runPipeline');
    expect(item.retryCount).toBe(0);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it('enqueue() returns the item with the correct payload', () => {
    const payload = { cowId: '0123456789', audioKey: 'audio/test.wav' };
    const item = queue.enqueue('runPipeline', payload);
    expect(item.payload).toEqual(payload);
  });

  it('enqueue() multiple items accumulates in the queue', () => {
    queue.enqueue('runPipeline', { a: 1 });
    queue.enqueue('saveVisit', { b: 2 });
    queue.enqueue('uploadAudio', { c: 3 });
    expect(queue.size()).toBe(3);
  });

  // 2. remove() deletes an item
  it('remove() deletes the item with the given id', () => {
    const item = queue.enqueue('runPipeline', {});
    expect(queue.size()).toBe(1);
    queue.remove(item.id);
    expect(queue.size()).toBe(0);
  });

  it('remove() only removes the targeted item', () => {
    const a = queue.enqueue('runPipeline', {});
    const b = queue.enqueue('saveVisit', {});
    queue.remove(a.id);
    const remaining = queue.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it('remove() with unknown id does not throw and leaves queue intact', () => {
    queue.enqueue('runPipeline', {});
    expect(() => queue.remove('nonexistent-id')).not.toThrow();
    expect(queue.size()).toBe(1);
  });

  // 3. incrementRetry() increases retry count
  it('incrementRetry() increments retryCount by 1', () => {
    const item = queue.enqueue('runPipeline', {});
    expect(item.retryCount).toBe(0);
    const updated = queue.incrementRetry(item.id);
    expect(updated).not.toBeNull();
    expect(updated!.retryCount).toBe(1);
  });

  it('incrementRetry() sets lastAttemptAt', () => {
    const item = queue.enqueue('runPipeline', {});
    const updated = queue.incrementRetry(item.id);
    expect(updated!.lastAttemptAt).toBeTruthy();
  });

  it('incrementRetry() returns null for unknown id', () => {
    const result = queue.incrementRetry('nonexistent-id');
    expect(result).toBeNull();
  });

  it('incrementRetry() persists the updated count', () => {
    const item = queue.enqueue('runPipeline', {});
    queue.incrementRetry(item.id);
    queue.incrementRetry(item.id);
    const all = queue.getAll();
    expect(all[0].retryCount).toBe(2);
  });

  // 4. getExhausted() returns items at maxRetries limit
  it('getExhausted() returns items whose retryCount >= maxRetries (default 5)', () => {
    const item = queue.enqueue('runPipeline', {});
    for (let i = 0; i < 5; i++) {
      queue.incrementRetry(item.id);
    }
    const exhausted = queue.getExhausted();
    expect(exhausted).toHaveLength(1);
    expect(exhausted[0].id).toBe(item.id);
    expect(exhausted[0].retryCount).toBe(5);
  });

  it('getExhausted() does not include items below maxRetries', () => {
    const item = queue.enqueue('runPipeline', {});
    for (let i = 0; i < 4; i++) {
      queue.incrementRetry(item.id);
    }
    expect(queue.getExhausted()).toHaveLength(0);
  });

  it('getExhausted() respects custom maxRetries option', () => {
    const q = makeQueue({ maxRetries: 2 });
    q.clear();
    const item = q.enqueue('runPipeline', {});
    q.incrementRetry(item.id);
    q.incrementRetry(item.id);
    expect(q.getExhausted()).toHaveLength(1);
  });

  // 5. removeExhausted() removes items at retry limit
  it('removeExhausted() removes exhausted items and keeps non-exhausted', () => {
    const exhausted = queue.enqueue('runPipeline', {});
    const active = queue.enqueue('saveVisit', {});
    for (let i = 0; i < 5; i++) {
      queue.incrementRetry(exhausted.id);
    }
    queue.removeExhausted();
    const remaining = queue.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(active.id);
  });

  it('removeExhausted() on empty queue does not throw', () => {
    expect(() => queue.removeExhausted()).not.toThrow();
  });

  // 6. getRetryDelay() uses exponential backoff
  it('getRetryDelay() returns baseDelayMs for retryCount=0 (1000ms)', () => {
    const item = queue.enqueue('runPipeline', {});
    expect(queue.getRetryDelay(item)).toBe(1000);
  });

  it('getRetryDelay() doubles for retryCount=1 (2000ms)', () => {
    const item = queue.enqueue('runPipeline', {});
    const updated = queue.incrementRetry(item.id)!;
    expect(queue.getRetryDelay(updated)).toBe(2000);
  });

  it('getRetryDelay() quadruples for retryCount=2 (4000ms)', () => {
    const item = queue.enqueue('runPipeline', {});
    queue.incrementRetry(item.id);
    const updated = queue.incrementRetry(item.id)!;
    expect(queue.getRetryDelay(updated)).toBe(4000);
  });

  it('getRetryDelay() is capped at maxDelayMs', () => {
    const q = makeQueue({ baseDelayMs: 1000, maxDelayMs: 5000 });
    q.clear();
    const item = q.enqueue('runPipeline', {});
    // retryCount=10 would give 1000 * 2^10 = 1024000, capped at 5000
    const fakeItem = { ...item, retryCount: 10 };
    expect(q.getRetryDelay(fakeItem)).toBe(5000);
  });

  // 7. clear() empties the queue
  it('clear() removes all items', () => {
    queue.enqueue('runPipeline', {});
    queue.enqueue('saveVisit', {});
    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.getAll()).toHaveLength(0);
  });

  // 8. size() returns correct count
  it('size() returns 0 for empty queue', () => {
    expect(queue.size()).toBe(0);
  });

  it('size() returns correct count after multiple enqueues', () => {
    queue.enqueue('a', {});
    queue.enqueue('b', {});
    queue.enqueue('c', {});
    expect(queue.size()).toBe(3);
  });

  it('size() decreases after remove()', () => {
    const item = queue.enqueue('runPipeline', {});
    queue.enqueue('saveVisit', {});
    queue.remove(item.id);
    expect(queue.size()).toBe(1);
  });

  // getAll() returns all items
  it('getAll() returns all enqueued items in order', () => {
    const a = queue.enqueue('runPipeline', { n: 1 });
    const b = queue.enqueue('saveVisit', { n: 2 });
    const all = queue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(a.id);
    expect(all[1].id).toBe(b.id);
  });
});
