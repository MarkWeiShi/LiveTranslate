import { useEffect, useRef, useState } from 'react';
import { Image, View, StyleSheet, type ViewStyle } from 'react-native';
import { avatarUrl, TALK_LIPS, IDLE_LIPS } from '@/game/avatar';
import { wolf } from '@/theme';

// DiceBear lip-sync 头像（移植自 wolfcha TalkingAvatar）：说话时每 120ms 切嘴型。
// 跨端零依赖：只是定时换 Image 的 uri。
interface Props {
  seed: string;
  size?: number;
  talking?: boolean;
  dead?: boolean;
  ring?: string | null; // 边框高亮色（发言/选中）
  bg?: string;
}

export function LipSyncAvatar({ seed, size = 56, talking = false, dead = false, ring = null, bg }: Props) {
  const [lips, setLips] = useState<string>(IDLE_LIPS);
  const idx = useRef(0);

  useEffect(() => {
    if (!talking) {
      setLips(IDLE_LIPS);
      return;
    }
    idx.current = 0;
    setLips(TALK_LIPS[0]);
    const id = setInterval(() => {
      idx.current = (idx.current + 1) % TALK_LIPS.length;
      setLips(TALK_LIPS[idx.current]);
    }, 120);
    return () => clearInterval(id);
  }, [talking]);

  const wrap: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? 2 : 1,
    borderColor: ring ?? wolf.border,
    overflow: 'hidden',
    opacity: dead ? 0.4 : 1,
    backgroundColor: wolf.panelDark,
    ...(ring ? { shadowColor: ring, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : {}),
  };

  return (
    <View style={wrap}>
      <Image
        source={{ uri: avatarUrl(seed, { lips, backgroundColor: bg ?? 'transparent' }) }}
        style={[styles.img, dead ? styles.grey : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '100%' },
  // RN-web 支持 filter 字符串；原生忽略（已用 opacity 兜底）
  grey: { filter: 'grayscale(1)' } as object,
});
