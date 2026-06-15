import { ENV } from '@/config/env';
import type { MediaTransport } from './types';
import { MockWebRtcTransport } from './mockTransport';

// Factory: the only place that knows which transport impl is active.
export function createTransport(): MediaTransport {
  if (ENV.transport === 'livekit') {
    // LiveKitTransport would be constructed here (real mode). Not implemented in MVP.
    throw new Error('LiveKit transport not implemented in MVP. Set EXPO_PUBLIC_TRANSPORT=mock.');
  }
  return new MockWebRtcTransport();
}
