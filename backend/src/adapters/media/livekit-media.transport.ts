import { InternalServerErrorException } from '@nestjs/common';
import type { MediaTransport, RoomHandle } from './media-transport.interface';

/** Real LiveKit transport — stub. Flip MEDIA_PROVIDER=livekit + creds to implement (real token mint). */
export class LiveKitMediaTransport implements MediaTransport {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createRoom(_callId: string): Promise<RoomHandle> {
    throw new InternalServerErrorException({
      code: 'LIVEKIT_NOT_CONFIGURED',
      message: 'LiveKit transport not implemented in MVP. Set MEDIA_PROVIDER=mock.',
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async mintToken(_userId: string, _room: string): Promise<string> {
    throw new InternalServerErrorException({
      code: 'LIVEKIT_NOT_CONFIGURED',
      message: 'LiveKit transport not implemented in MVP. Set MEDIA_PROVIDER=mock.',
    });
  }
}
