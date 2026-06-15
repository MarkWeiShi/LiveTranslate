import { forwardRef, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { WS_EVENTS, type WebrtcSignalPayload } from '@linku/shared';
import { SocketRegistry } from './socket-registry';
import { RealtimeEmitter } from './realtime.emitter';
import { CallsService } from '../calls/calls.service';

interface RelayBody {
  callId: string;
  toUserId: string;
  payload: unknown;
}

@WebSocketGateway({ path: '/ws', cors: { origin: '*' } })
export class SignalingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger('SignalingGateway');

  constructor(
    private registry: SocketRegistry,
    private emitter: RealtimeEmitter,
    private jwt: JwtService,
    @Inject(forwardRef(() => CallsService)) private calls: CallsService,
  ) {}

  afterInit(server: Server) {
    this.emitter.setServer(server);
  }

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET ?? 'dev_secret',
      });
      client.data.userId = payload.sub;
      this.registry.add(payload.sub, client.id);
    } catch {
      this.log.warn(`unauthorized socket ${client.id} — disconnecting`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const { userId, lastSocket } = this.registry.remove(client.id);
    if (userId && lastSocket) {
      await this.calls.handleDisconnect(userId);
    }
  }

  private relay(client: Socket, event: string, body: RelayBody) {
    const fromUserId = client.data.userId as string;
    if (!fromUserId || !body?.toUserId) return;
    const out: WebrtcSignalPayload = {
      callId: body.callId,
      fromUserId,
      payload: body.payload,
    };
    this.emitter.emitToUser(body.toUserId, event, out);
  }

  @SubscribeMessage(WS_EVENTS.WEBRTC_OFFER)
  onOffer(@ConnectedSocket() c: Socket, @MessageBody() b: RelayBody) {
    this.relay(c, WS_EVENTS.WEBRTC_OFFER, b);
  }

  @SubscribeMessage(WS_EVENTS.WEBRTC_ANSWER)
  onAnswer(@ConnectedSocket() c: Socket, @MessageBody() b: RelayBody) {
    this.relay(c, WS_EVENTS.WEBRTC_ANSWER, b);
  }

  @SubscribeMessage(WS_EVENTS.WEBRTC_ICE)
  onIce(@ConnectedSocket() c: Socket, @MessageBody() b: RelayBody) {
    this.relay(c, WS_EVENTS.WEBRTC_ICE, b);
  }
}
