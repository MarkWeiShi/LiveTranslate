import { io, type Socket } from 'socket.io-client';
import { ENV } from '@/config/env';

let socket: Socket | null = null;

export function connectWs(token: string): Socket {
  if (socket) socket.disconnect();
  socket = io(ENV.wsBase, {
    path: '/ws',
    transports: ['websocket'],
    auth: { token },
    forceNew: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectWs() {
  socket?.disconnect();
  socket = null;
}
