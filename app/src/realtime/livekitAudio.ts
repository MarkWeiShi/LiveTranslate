import { ENV } from '@/config/env';

export interface RoomAudioHandle {
  disconnect: () => void;
}

/**
 * 巴别塔语聊房真实音频（LiveKit）：连接房间、推麦克风、播放他人音轨。
 * 仅在 `EXPO_PUBLIC_TRANSPORT=livekit` + 配了 `EXPO_PUBLIC_LIVEKIT_URL` + Web 环境时生效；
 * 否则 no-op（mock 模式打字体验不变）。livekit-client 懒加载，避免拖累首屏/原生包。
 * 真实出声需后端 `MEDIA_PROVIDER=livekit`（join 返回真实 token）。见 LIVEKIT-SETUP.md。
 */
export async function connectRoomAudio(token: string): Promise<RoomAudioHandle | null> {
  if (ENV.transport !== 'livekit' || !ENV.livekitUrl) return null;
  if (typeof document === 'undefined') return null; // web only

  const { Room, RoomEvent, Track } = await import('livekit-client');
  const room = new Room({ adaptiveStream: true, dynacast: true });

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.setAttribute('data-lk-audio', '1');
      document.body.appendChild(el);
    }
  });

  await room.connect(ENV.livekitUrl, token);
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch {
    /* 麦克风权限被拒：仍可只收听 */
  }

  return {
    disconnect: () => {
      room.disconnect();
      document.querySelectorAll('[data-lk-audio]').forEach((n) => n.remove());
    },
  };
}
