// Mock media transport (web): real browser-to-browser WebRTC, SDP/ICE signaled over the
// backend WS (/ws). On localhost this connects with host candidates only — no STUN/TURN,
// no external account. Two browser windows therefore see each other's webcam (AC-CALL-1).
// Fallback EXPO_PUBLIC_MOCK_MEDIA=loopback renders the local stream as "remote" for a
// single-camera box. The In-Call screen never branches on this — it only uses MediaTransport.
import { ENV } from '@/config/env';
import { WS_EVENTS, type WebrtcSignalPayload } from '@linku/shared';
import { getSocket } from '@/realtime/ws';
import type {
  JoinParams,
  MediaTransport,
  TransportEvents,
} from './types';

export class MockWebRtcTransport implements MediaTransport {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remoteEl?: HTMLAudioElement | HTMLVideoElement;
  private offs: Array<() => void> = [];
  private params!: JoinParams;
  private events!: TransportEvents;

  async join(params: JoinParams, events: TransportEvents): Promise<void> {
    this.params = params;
    this.events = events;
    events.onConnectionState?.('connecting');

    this.local = await navigator.mediaDevices.getUserMedia({
      video: params.video,
      audio: true,
    });
    events.onLocalStream?.(this.local);

    if (ENV.mockMedia === 'loopback') {
      events.onRemoteStream?.(this.local);
      events.onConnectionState?.('connected');
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    this.local.getTracks().forEach((t) => pc.addTrack(t, this.local!));

    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      events.onRemoteStream?.(remote);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(WS_EVENTS.WEBRTC_ICE, e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') events.onConnectionState?.('connected');
      else if (pc.connectionState === 'failed') events.onConnectionState?.('failed');
    };

    const socket = getSocket();
    if (!socket) throw new Error('WS not connected');

    const onOffer = async (p: WebrtcSignalPayload) => {
      if (p.callId !== params.callId) return;
      await pc.setRemoteDescription(p.payload as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(WS_EVENTS.WEBRTC_ANSWER, answer);
    };
    const onAnswer = async (p: WebrtcSignalPayload) => {
      if (p.callId !== params.callId) return;
      await pc.setRemoteDescription(p.payload as RTCSessionDescriptionInit);
    };
    const onIce = async (p: WebrtcSignalPayload) => {
      if (p.callId !== params.callId) return;
      try {
        await pc.addIceCandidate(p.payload as RTCIceCandidateInit);
      } catch {
        /* ignore */
      }
    };
    socket.on(WS_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(WS_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(WS_EVENTS.WEBRTC_ICE, onIce);
    this.offs.push(
      () => socket.off(WS_EVENTS.WEBRTC_OFFER, onOffer),
      () => socket.off(WS_EVENTS.WEBRTC_ANSWER, onAnswer),
      () => socket.off(WS_EVENTS.WEBRTC_ICE, onIce),
    );

    if (params.shouldOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signal(WS_EVENTS.WEBRTC_OFFER, offer);
    }
  }

  private signal(event: string, payload: unknown) {
    getSocket()?.emit(event, {
      callId: this.params.callId,
      toUserId: this.params.peerUserId,
      payload,
    });
  }

  leave(): void {
    this.offs.forEach((f) => f());
    this.offs = [];
    this.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.local = null;
    this.events?.onConnectionState?.('closed');
  }

  setMicEnabled(on: boolean): void {
    this.local?.getAudioTracks().forEach((t) => (t.enabled = on));
  }
  setCamEnabled(on: boolean): void {
    this.local?.getVideoTracks().forEach((t) => (t.enabled = on));
  }
  attachRemoteElement(el: HTMLVideoElement | HTMLAudioElement) {
    this.remoteEl = el;
  }
  duckRemoteAudio(duck: boolean): void {
    if (this.remoteEl) this.remoteEl.volume = duck ? 0.15 : 1;
  }
}
