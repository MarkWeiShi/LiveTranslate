// Media transport seam — In-Call screen programs against this; Mock (WebRTC over WS) and
// future LiveKit impls are interchangeable via createTransport().

export type ConnectionState = 'connecting' | 'connected' | 'failed' | 'closed';

export interface TransportEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionState?: (s: ConnectionState) => void;
  onError?: (e: Error) => void;
}

export interface JoinParams {
  callId: string;
  selfUserId: string;
  peerUserId: string;
  // The callee offers: the caller has been subscribed since the ringing screen, so the
  // callee (who joins last, on accept) creates the offer to avoid a lost-offer race.
  shouldOffer: boolean;
  video: boolean;
}

export interface MediaTransport {
  join(params: JoinParams, events: TransportEvents): Promise<void>;
  leave(): void;
  setMicEnabled(on: boolean): void;
  setCamEnabled(on: boolean): void;
  duckRemoteAudio(duck: boolean): void;
}
