import type {
  PresenceState,
  PresenceStore,
} from './presence-store.interface';

interface Entry extends PresenceState {
  expiresAt: number;
}

export class InMemoryPresenceStore implements PresenceStore {
  private map = new Map<string, Entry>();
  private janitor: NodeJS.Timeout;

  constructor() {
    this.janitor = setInterval(() => {
      const now = Date.now();
      for (const [k, e] of this.map) if (e.expiresAt <= now) this.map.delete(k);
    }, 10_000);
    if (typeof this.janitor.unref === 'function') this.janitor.unref();
  }

  private live(userId: string): Entry | null {
    const e = this.map.get(userId);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.map.delete(userId);
      return null;
    }
    return e;
  }

  async heartbeat(
    userId: string,
    availableForCall: boolean,
    ttlSec: number,
  ): Promise<void> {
    this.map.set(userId, {
      online: true,
      availableForCall,
      lastSeen: Date.now(),
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  async get(userId: string): Promise<PresenceState | null> {
    const e = this.live(userId);
    return e
      ? { online: e.online, availableForCall: e.availableForCall, lastSeen: e.lastSeen }
      : null;
  }

  async getMany(userIds: string[]): Promise<Map<string, PresenceState>> {
    const out = new Map<string, PresenceState>();
    for (const id of userIds) {
      const s = await this.get(id);
      if (s) out.set(id, s);
    }
    return out;
  }

  async isOnline(userId: string): Promise<boolean> {
    return !!this.live(userId)?.online;
  }

  async isAvailable(userId: string): Promise<boolean> {
    const e = this.live(userId);
    return !!e && e.online && e.availableForCall;
  }

  async clear(userId: string): Promise<void> {
    this.map.delete(userId);
  }
}
