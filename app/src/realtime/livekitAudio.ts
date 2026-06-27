import { ENV } from '@/config/env';

export interface RoomAudioHandle {
  disconnect: () => void;
  setMicEnabled: (on: boolean) => Promise<void>;
  micEnabled: () => boolean;
  connected: boolean;
}

/**
 * 语音房真实音频（LiveKit）：连接房间、推麦克风、播放他人音轨。
 * 仅在 `EXPO_PUBLIC_TRANSPORT=livekit` + 配了 `EXPO_PUBLIC_LIVEKIT_URL` + Web 环境时生效；
 * 否则返回 null（mock 模式打字体验不变）。livekit-client 懒加载，避免拖累首屏/原生包。
 * 真实出声需后端 `MEDIA_PROVIDER=livekit`（join 返回真实 token）。见 LIVEKIT-SETUP.md。
 *
 * 狼人杀场景：startMuted=true 进房（保持"单麦"——只在发言轮开麦），由调用方按回合切换。
 */
export async function connectRoomAudio(token: string, opts: { startMuted?: boolean } = {}): Promise<RoomAudioHandle | null> {
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

  let mic = false;
  if (!opts.startMuted) {
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      mic = true;
    } catch {
      /* 麦克风权限被拒：仍可只收听 */
    }
  }

  return {
    connected: true,
    micEnabled: () => mic,
    setMicEnabled: async (on: boolean) => {
      try {
        await room.localParticipant.setMicrophoneEnabled(on);
        mic = on;
      } catch {
        mic = false; // 权限失败
      }
    },
    disconnect: () => {
      room.disconnect();
      document.querySelectorAll('[data-lk-audio]').forEach((n) => n.remove());
    },
  };
}
