import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Pressable } from 'react-native';
import type { WolfRolePayload } from '@linku/shared';
import { wolf } from '@/theme';

// 发牌翻牌 + 角色卡入场（移植自 wolfcha RoleRevealOverlay，用 RN Animated）。
// 进场：遮罩淡入 + 卡片弹簧上浮；650ms 后翻牌（rotateY 180→0）。
const ROLE_EMOJI: Record<string, string> = {
  WOLF: '🐺', SEER: '🔮', WITCH: '🧪', HUNTER: '🔫', VILLAGER: '🧑‍🌾',
};

export function RoleRevealCard({ role, onContinue }: { role: WolfRolePayload; onContinue: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current; // 0=背面(180°) 1=正面(0°)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 1, stiffness: 420, damping: 34, mass: 1, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(flip, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    }, 650);
    return () => clearTimeout(t);
  }, [fade, rise, flip]);

  const accent = wolf.role[role.role] ?? wolf.gold;
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const frontSpin = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backSpin = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]}>
      <Animated.View style={[styles.cardWrap, { transform: [{ translateY }] }]}>
        {/* 背面（发牌中） */}
        <Animated.View
          style={[styles.card, styles.cardBack, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backSpin }] }]}
        >
          <Text style={styles.dealHint}>正在发牌…</Text>
          <Text style={styles.dealMark}>🂠</Text>
          <Text style={styles.dealHint}>身份将仅你可见</Text>
        </Animated.View>
        {/* 正面（角色） */}
        <Animated.View
          style={[styles.card, { borderColor: accent, opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontSpin }] }]}
        >
          <Text style={styles.seat}>{role.seatNo} 号 · {role.camp === 'WOLF' ? '狼人阵营' : '好人阵营'}</Text>
          <Text style={styles.emoji}>{ROLE_EMOJI[role.role] ?? '❔'}</Text>
          <Text style={[styles.title, { color: accent }]}>{role.roleName}</Text>
          <Text style={styles.desc}>{role.roleDesc}</Text>
          {role.teammates && role.teammates.length > 0 && (
            <Text style={styles.team}>狼队友：{role.teammates.map((t) => `${t.seatNo}号`).join('、')}</Text>
          )}
          <Pressable onPress={onContinue} style={[styles.btn, { backgroundColor: accent }]}>
            <Text style={styles.btnText}>知道了，开始</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  cardWrap: { width: 300 },
  card: {
    position: 'absolute', width: 300, minHeight: 360, borderRadius: 24, padding: 24,
    backgroundColor: wolf.darkSecondary, borderWidth: 2, alignItems: 'center', gap: 10,
    backfaceVisibility: 'hidden',
  },
  cardBack: { borderColor: wolf.gold, justifyContent: 'center' },
  dealHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  dealMark: { fontSize: 72, color: wolf.gold, marginVertical: 16 },
  seat: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  emoji: { fontSize: 64, marginTop: 8 },
  title: { fontSize: 30, fontWeight: '900' },
  desc: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  team: { color: wolf.bloodLight, fontSize: 13, fontWeight: '700', marginTop: 4 },
  btn: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
