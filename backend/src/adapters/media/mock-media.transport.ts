import { createHmac } from 'crypto';
import type { MediaTransport, RoomHandle } from './media-transport.interface';

/**
 * Mock transport: synthetic room name + a signed (but never externally validated) token.
 * The actual peer-to-peer media in the web demo is browser WebRTC signaled over the backend WS;
 * this token is just an opaque per-(user,room) credential placeholder (BuildSpec §2.4).
 */
export class MockMediaTransport implements MediaTransport {
  private readonly secret = process.env.JWT_SECRET ?? 'dev_secret';
  private nonce = 0;

  async createRoom(callId: string): Promise<RoomHandle> {
    return { room: `call_${callId}` };
  }

  async mintToken(userId: string, room: string): Promise<string> {
    const payload = `${userId}.${room}.${++this.nonce}`;
    const sig = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    return `mock.${Buffer.from(payload).toString('base64url')}.${sig}`;
  }
}
