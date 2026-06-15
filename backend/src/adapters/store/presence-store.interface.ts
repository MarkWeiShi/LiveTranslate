export interface PresenceState {
  online: boolean;
  availableForCall: boolean;
  lastSeen: number;
}

export interface PresenceStore {
  heartbeat(
    userId: string,
    availableForCall: boolean,
    ttlSec: number,
  ): Promise<void>;
  get(userId: string): Promise<PresenceState | null>;
  getMany(userIds: string[]): Promise<Map<string, PresenceState>>;
  isOnline(userId: string): Promise<boolean>;
  isAvailable(userId: string): Promise<boolean>;
  clear(userId: string): Promise<void>;
}
