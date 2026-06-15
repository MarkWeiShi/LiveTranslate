export interface KvStore {
  get<T>(k: string): Promise<T | null>;
  set<T>(k: string, v: T, ttlSec?: number): Promise<void>;
  del(k: string): Promise<void>;
  incr(k: string): Promise<number>;
  /** Concurrency guard: returns true if acquired (key was free). */
  acquireLock(k: string, ttlSec: number): Promise<boolean>;
  releaseLock(k: string): Promise<void>;
}
