// WebSocket event contracts (BuildSpec §5.2). In mock mode these flow over the
// backend Socket.IO /ws channel; payloads are identical to the future LiveKit DataChannel.
import type { CallMode, TranslationState } from './enums';
import type { UserCard } from './dto';

// ---- Server -> Client event names ----
export const WS_EVENTS = {
  INCOMING_CALL: 'incoming_call',
  CALL_ACCEPTED: 'call_accepted',
  CALL_DECLINED: 'call_declined',
  CALL_ENDED: 'call_ended',
  CAPTION: 'caption',
  TRANSLATION_STATE: 'translation.state',
  TRANSLATION_PAYWALL: 'translation.paywall',
  GIFT_RECEIVED: 'gift_received',
  RISK_WARNING: 'risk_warning',
  // WebRTC signaling relay (mock media transport, localhost)
  WEBRTC_OFFER: 'webrtc.offer',
  WEBRTC_ANSWER: 'webrtc.answer',
  WEBRTC_ICE: 'webrtc.ice',
} as const;

// ---- Client -> Server event names ----
export const WS_CLIENT_EVENTS = {
  WEBRTC_OFFER: 'webrtc.offer',
  WEBRTC_ANSWER: 'webrtc.answer',
  WEBRTC_ICE: 'webrtc.ice',
} as const;

export interface IncomingCallPayload {
  callId: string;
  caller: UserCard;
  mode: CallMode;
  room: string;
}

export interface CallAcceptedPayload {
  callId: string;
  room: string;
}

export interface CallDeclinedPayload {
  callId: string;
  reason?: string;
}

export interface CallEndedPayload {
  callId: string;
  reason?: string;
  durationSec: number;
  translatedSec: number;
}

export interface CaptionPayload {
  callId: string;
  speakerId: string;
  originalText: string;
  translatedText: string;
  ts: number;
}

export interface TranslationStatePayload {
  callId: string;
  state: TranslationState;
  translatedSecLeft: number;
}

export interface TranslationPaywallPayload {
  callId: string;
  reason: 'trial_exhausted';
}

export interface GiftReceivedPayload {
  callId: string;
  fromId: string;
  giftType: string;
}

export interface RiskWarningPayload {
  callId?: string;
  level: 'medium' | 'high';
  message: string;
  riskType: string;
}

// WebRTC signaling relay payloads (mock transport)
export interface WebrtcSignalPayload {
  callId: string;
  fromUserId: string;
  payload: unknown; // RTCSessionDescriptionInit | RTCIceCandidateInit
}
