import { Injectable } from '@nestjs/common';

/** Tracks which socket ids belong to which user (a user may have multiple tabs). */
@Injectable()
export class SocketRegistry {
  private userToSockets = new Map<string, Set<string>>();
  private socketToUser = new Map<string, string>();

  add(userId: string, socketId: string) {
    this.socketToUser.set(socketId, userId);
    let set = this.userToSockets.get(userId);
    if (!set) {
      set = new Set();
      this.userToSockets.set(userId, set);
    }
    set.add(socketId);
  }

  /** Removes a socket; returns the userId and whether that was their last socket. */
  remove(socketId: string): { userId?: string; lastSocket: boolean } {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return { lastSocket: false };
    this.socketToUser.delete(socketId);
    const set = this.userToSockets.get(userId);
    set?.delete(socketId);
    const lastSocket = !set || set.size === 0;
    if (lastSocket) this.userToSockets.delete(userId);
    return { userId, lastSocket };
  }

  socketsOf(userId: string): string[] {
    return Array.from(this.userToSockets.get(userId) ?? []);
  }

  isConnected(userId: string): boolean {
    return (this.userToSockets.get(userId)?.size ?? 0) > 0;
  }
}
