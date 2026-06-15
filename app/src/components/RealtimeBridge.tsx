import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  WS_EVENTS,
  type CallEndedPayload,
  type CaptionPayload,
  type GiftReceivedPayload,
  type IncomingCallPayload,
  type RiskWarningPayload,
  type TranslationPaywallPayload,
  type TranslationStatePayload,
} from '@linku/shared';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { getSocket } from '@/realtime/ws';

/** Wires WS server-events into the call store + navigation. Mounted once at root. */
export function RealtimeBridge() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !token) return;
    const call = useCallStore.getState();

    const onIncoming = (p: IncomingCallPayload) => {
      // ignore if already in a call
      if (!useCallStore.getState().active) call.setIncoming(p);
    };
    const onDeclined = () => {
      useCallStore.getState().reset();
      router.replace('/');
    };
    const onEnded = (p: CallEndedPayload) => {
      useCallStore.getState().endActive({ callId: p.callId, durationSec: p.durationSec, translatedSec: p.translatedSec });
      router.replace('/');
    };
    const onCaption = (p: CaptionPayload) => useCallStore.getState().pushCaption(p);
    const onState = (p: TranslationStatePayload) =>
      useCallStore.getState().setTranslationState(p.state, p.translatedSecLeft);
    const onPaywall = (_p: TranslationPaywallPayload) => {
      useCallStore.getState().setTranslationState('paywall');
      useCallStore.getState().showPaywall(true);
    };
    const onGift = (p: GiftReceivedPayload) => useCallStore.getState().flashGift(p.giftType);
    const onRisk = (p: RiskWarningPayload) => useCallStore.getState().setRisk(p);

    socket.on(WS_EVENTS.INCOMING_CALL, onIncoming);
    socket.on(WS_EVENTS.CALL_DECLINED, onDeclined);
    socket.on(WS_EVENTS.CALL_ENDED, onEnded);
    socket.on(WS_EVENTS.CAPTION, onCaption);
    socket.on(WS_EVENTS.TRANSLATION_STATE, onState);
    socket.on(WS_EVENTS.TRANSLATION_PAYWALL, onPaywall);
    socket.on(WS_EVENTS.GIFT_RECEIVED, onGift);
    socket.on(WS_EVENTS.RISK_WARNING, onRisk);

    return () => {
      socket.off(WS_EVENTS.INCOMING_CALL, onIncoming);
      socket.off(WS_EVENTS.CALL_DECLINED, onDeclined);
      socket.off(WS_EVENTS.CALL_ENDED, onEnded);
      socket.off(WS_EVENTS.CAPTION, onCaption);
      socket.off(WS_EVENTS.TRANSLATION_STATE, onState);
      socket.off(WS_EVENTS.TRANSLATION_PAYWALL, onPaywall);
      socket.off(WS_EVENTS.GIFT_RECEIVED, onGift);
      socket.off(WS_EVENTS.RISK_WARNING, onRisk);
    };
  }, [token, router]);

  return null;
}
