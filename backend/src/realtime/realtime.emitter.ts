import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { SocketRegistry } from './socket-registry';

/**
 * Emits server->client events to a specific user across all their sockets.
 * In mock mode this is the transport for caption/translation.state/paywall etc.
 * (replacing the LiveKit DataChannel); payload shapes are identical.
 */
@Injectable()
export class RealtimeEmitter {
  private server: Server | null = null;

  constructor(private registry: SocketRegistry) {}

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) return;
    for (const sid of this.registry.socketsOf(userId)) {
      this.server.to(sid).emit(event, payload);
    }
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const id of userIds) this.emitToUser(id, event, payload);
  }
}
