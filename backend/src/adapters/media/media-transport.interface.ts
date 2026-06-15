export interface RoomHandle {
  room: string;
}

export interface MediaTransport {
  createRoom(callId: string): Promise<RoomHandle>;
  mintToken(userId: string, room: string): Promise<string>;
}
