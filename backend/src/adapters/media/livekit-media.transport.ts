import { InternalServerErrorException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import type { MediaTransport, RoomHandle } from './media-transport.interface';

/**
 * 真实 LiveKit 媒体传输：签发可加入房间的 AccessToken（JWT，HS256，由 API key/secret 签名）。
 * 房间在首个参会者带 token 加入时自动创建，故 createRoom 无需调服务端（离线可签发）。
 * 需 env：LIVEKIT_API_KEY / LIVEKIT_API_SECRET（客户端另用 LIVEKIT_URL）。切真实属 human checkpoint。
 */
export class LiveKitMediaTransport implements MediaTransport {
  private creds() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new InternalServerErrorException({
        code: 'LIVEKIT_NOT_CONFIGURED',
        message: '缺少 LIVEKIT_API_KEY / LIVEKIT_API_SECRET（或将 MEDIA_PROVIDER 设回 mock）。',
      });
    }
    return { apiKey, apiSecret };
  }

  async createRoom(callId: string): Promise<RoomHandle> {
    this.creds(); // 校验配置；房间名确定即可，加入时自动建房
    return { room: `lk_${callId}` };
  }

  async mintToken(userId: string, room: string): Promise<string> {
    const { apiKey, apiSecret } = this.creds();
    const at = new AccessToken(apiKey, apiSecret, { identity: userId });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    return at.toJwt();
  }
}
