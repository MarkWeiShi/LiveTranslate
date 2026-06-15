import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { ENV } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { createTransport } from '@/realtime/transport/createTransport';
import type { MediaTransport } from '@/realtime/transport/types';
import { VideoStream } from '@/components/VideoStream';
import { Avatar } from '@/components/ui';
import { PaywallSheet } from '@/components/PaywallSheet';
import { colors, radius } from '@/theme';

function fmt(sec: number) {
  if (sec < 0) return '∞';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function InCallScreen() {
  const router = useRouter();
  const selfId = useAuthStore((s) => s.me?.id);
  const active = useCallStore((s) => s.active);
  const captions = useCallStore((s) => s.captions);
  const translationState = useCallStore((s) => s.translationState);
  const translationOn = useCallStore((s) => s.translationOn);
  const trialSecondsLeft = useCallStore((s) => s.trialSecondsLeft);
  const paywallVisible = useCallStore((s) => s.paywallVisible);
  const risk = useCallStore((s) => s.risk);
  const giftFlash = useCallStore((s) => s.giftFlash);
  const setTranslationOn = useCallStore((s) => s.setTranslationOn);
  const showPaywall = useCallStore((s) => s.showPaywall);
  const reset = useCallStore((s) => s.reset);

  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [conn, setConn] = useState<string>('connecting');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [duck, setDuck] = useState(false);
  const transportRef = useRef<MediaTransport | null>(null);

  const isVideo = active?.mode === 'VIDEO';

  // join transport on mount
  useEffect(() => {
    if (!active || !selfId || !active.peer) {
      router.replace('/');
      return;
    }
    const t = createTransport();
    transportRef.current = t;
    void t.join(
      {
        callId: active.callId,
        selfUserId: selfId,
        peerUserId: active.peer.id,
        shouldOffer: !active.isCaller, // callee offers (caller subscribed first)
        video: isVideo,
      },
      {
        onLocalStream: setLocal,
        onRemoteStream: setRemote,
        onConnectionState: setConn,
        onError: () => setConn('failed'),
      },
    );
    return () => t.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // duck remote audio + TTS when peer speaks (a new caption from the peer arrives)
  const lastCap = captions[captions.length - 1];
  useEffect(() => {
    if (!lastCap || lastCap.speakerId === selfId) return;
    if (translationState !== 'active') return;
    setDuck(true);
    const t = setTimeout(() => setDuck(false), 2500);
    if (ENV.mockTts && lastCap.translatedText && typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.speak(new SpeechSynthesisUtterance(lastCap.translatedText));
      } catch {
        /* ignore */
      }
    }
    return () => clearTimeout(t);
  }, [lastCap, selfId, translationState]);

  const status = useMemo(() => {
    switch (translationState) {
      case 'degraded':
        return { text: '字幕模式（已降级）', color: colors.warn };
      case 'paused':
        return { text: '翻译已暂停', color: colors.textDim };
      case 'paywall':
        return { text: '翻译已暂停（试用用尽）', color: colors.accent };
      default:
        return { text: `翻译中 · 剩余试用 ${fmt(trialSecondsLeft)}`, color: colors.online };
    }
  }, [translationState, trialSecondsLeft]);

  if (!active || !active.peer) return null;
  const peer = active.peer;

  const toggleMic = () => {
    const v = !mic;
    setMic(v);
    transportRef.current?.setMicEnabled(v);
  };
  const toggleCam = () => {
    const v = !cam;
    setCam(v);
    transportRef.current?.setCamEnabled(v);
  };
  const toggleXlate = async () => {
    const next = !translationOn;
    setTranslationOn(next);
    try {
      const res = await api.toggleTranslation(active.callId, next);
      if (res?.paywall) showPaywall(true);
    } catch {
      /* ignore */
    }
  };
  const sendGift = async () => {
    try {
      await api.sendGift(active.callId, 'rose');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_DIAMONDS') showPaywall(true);
    }
  };
  const hangup = async () => {
    transportRef.current?.leave();
    await api.endCall(active.callId, 'hangup').catch(() => undefined);
    reset();
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* remote / peer */}
      <View style={StyleSheet.absoluteFill}>
        {isVideo && remote ? (
          <VideoStream stream={remote} volume={duck ? 0.15 : 1} />
        ) : (
          <View style={styles.voiceBg}>
            <Avatar uri={peer.avatarUrl} size={140} />
            <Text style={styles.voiceName}>{peer.displayName}</Text>
            <View style={[styles.speakDot, duck && { backgroundColor: colors.online }]} />
            <Text style={styles.voiceHint}>{duck ? '对方说话中（翻译）' : conn === 'connected' ? '已接通' : '正在接通…'}</Text>
          </View>
        )}
      </View>

      {/* status bar */}
      <View style={styles.statusBar} pointerEvents="none">
        <View style={[styles.statusPill, { borderColor: status.color }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
        </View>
        {conn !== 'connected' && <Text style={styles.connHint}>{conn === 'failed' ? '连接中断' : '正在接通…'}</Text>}
      </View>

      {/* risk banner */}
      {risk && (
        <View style={styles.riskBanner}>
          <Text style={styles.riskText}>{risk.message}</Text>
        </View>
      )}

      {/* local PiP */}
      {isVideo && local && (
        <View style={styles.pip}>
          <VideoStream stream={local} muted mirror radius={14} />
        </View>
      )}

      {/* gift flash */}
      {giftFlash && (
        <View style={styles.giftFlash} pointerEvents="none">
          <Text style={{ fontSize: 64 }}>{giftFlash === 'rose' ? '🌹' : '🎁'}</Text>
        </View>
      )}

      {/* captions */}
      <View style={styles.captionWrap} pointerEvents="none">
        <ScrollView contentContainerStyle={{ gap: 6, justifyContent: 'flex-end', flexGrow: 1 }}>
          {captions.slice(-4).map((c, i) => (
            <View key={`${c.ts}-${i}`} style={styles.caption}>
              <Text style={styles.capSpeaker}>{c.speakerId === selfId ? '我' : peer.displayName}</Text>
              <Text style={styles.capOrig}>{c.originalText}</Text>
              <Text style={styles.capTrans}>{c.translatedText}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* controls */}
      <View style={styles.controls}>
        <Circle label={mic ? '🎙' : '🔇'} onPress={toggleMic} active={mic} />
        {isVideo && <Circle label={cam ? '📷' : '🚫'} onPress={toggleCam} active={cam} />}
        <Circle label="🌐" onPress={toggleXlate} active={translationOn} />
        <Circle label="🌹" onPress={sendGift} />
        <Circle label="📵" onPress={hangup} danger />
      </View>

      <PaywallSheet visible={paywallVisible} onClose={() => showPaywall(false)} />
    </View>
  );
}

function Circle({ label, onPress, active, danger }: { label: string; onPress: () => void; active?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.circle,
        active && { backgroundColor: colors.primary },
        danger && { backgroundColor: colors.danger },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  voiceBg: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  voiceName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  voiceHint: { color: colors.textDim },
  speakDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textDim },
  statusBar: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center', gap: 6 },
  statusPill: { backgroundColor: '#000a', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  statusText: { fontWeight: '700', fontSize: 13 },
  connHint: { color: '#fff', fontSize: 12, backgroundColor: '#0008', paddingHorizontal: 8, borderRadius: 8 },
  riskBanner: { position: 'absolute', top: 84, left: 16, right: 16, backgroundColor: colors.danger, borderRadius: radius.md, padding: 10 },
  riskText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  pip: { position: 'absolute', top: 44, right: 16, width: 110, height: 150, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#fff3' },
  giftFlash: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  captionWrap: { position: 'absolute', left: 16, right: 16, bottom: 120, maxHeight: 200 },
  caption: { backgroundColor: '#000a', borderRadius: radius.md, padding: 10 },
  capSpeaker: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  capOrig: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  capTrans: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 2 },
  controls: { position: 'absolute', bottom: 28, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 },
  circle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
