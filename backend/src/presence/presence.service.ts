import { Inject, Injectable } from '@nestjs/common';
import { PRESENCE_TTL_SECONDS } from '@linku/shared';
import { PRESENCE_STORE } from '../config/provider.tokens';
import type {
  PresenceState,
  PresenceStore,
} from '../adapters/store/presence-store.interface';

@Injectable()
export class PresenceService {
  constructor(@Inject(PRESENCE_STORE) private store: PresenceStore) {}

  heartbeat(userId: string, availableForCall: boolean) {
    return this.store.heartbeat(userId, availableForCall, PRESENCE_TTL_SECONDS);
  }
  get(userId: string) {
    return this.store.get(userId);
  }
  getMany(userIds: string[]): Promise<Map<string, PresenceState>> {
    return this.store.getMany(userIds);
  }
  isOnline(userId: string) {
    return this.store.isOnline(userId);
  }
  isAvailable(userId: string) {
    return this.store.isAvailable(userId);
  }
  clear(userId: string) {
    return this.store.clear(userId);
  }
}
