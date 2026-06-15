import type { KvStore } from './kv-store.interface';

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

/** Single-process in-memory KV (replaces Redis for MVP). Lazy TTL on read + interval sweep. */
export class InMemoryKvStore implements KvStore {
  private map = new Map<string, Entry>();
  private janitor: NodeJS.Timeout;

  constructor() {
    this.janitor = setInterval(() => this.sweep(), 10_000);
    // Don't keep the event loop alive solely for the janitor.
    if (typeof this.janitor.unref === 'function') this.janitor.unref();
  }

  private sweep() {
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (e.expiresAt != null && e.expiresAt <= now) this.map.delete(k);
    }
  }

  private live(k: string): Entry | null {
    const e = this.map.get(k);
    if (!e) return null;
    if (e.expiresAt != null && e.expiresAt <= Date.now()) {
      this.map.delete(k);
      return null;
    }
    return e;
  }

  async get<T>(k: string): Promise<T | null> {
    const e = this.live(k);
    return e ? (e.value as T) : null;
  }

  async set<T>(k: string, v: T, ttlSec?: number): Promise<void> {
    this.map.set(k, {
      value: v,
      expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null,
    });
  }

  async del(k: string): Promise<void> {
    this.map.delete(k);
  }

  async incr(k: string): Promise<number> {
    const cur = (this.live(k)?.value as number) ?? 0;
    const next = cur + 1;
    this.map.set(k, { value: next, expiresAt: this.map.get(k)?.expiresAt ?? null });
    return next;
  }

  async acquireLock(k: string, ttlSec: number): Promise<boolean> {
    if (this.live(k)) return false;
    await this.set(k, 1, ttlSec);
    return true;
  }

  async releaseLock(k: string): Promise<void> {
    this.map.delete(k);
  }
}
