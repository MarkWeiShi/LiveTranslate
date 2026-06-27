import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { MotiView } from 'moti';
import type { WolfRolePayload } from '@linku/shared';
import { wolf } from '@/theme';

// 发牌翻牌 + 角色卡入场（移植自 wolfcha RoleRevealOverlay，用 Moti/Reanimated）。
// 进场：遮罩淡入 + 卡片弹簧上浮；650ms 后翻牌（rotateY 180→0）。
const ROLE_EMOJI: Record<string, string> = {
  WOLF: '🐺', SEER: '🔮', WITCH: '🧪', HUNTER: '🔫', VILLAGER: '🧑‍🌾',
};

export function RoleRevealCard({ role, onContinue }: { role: WolfRolePayload; onContinue: () => void }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 650);
    return () => clearTimeout(t);
  }, []);

  const accent = wolf.role[role.role] ?? wolf.gold;

  return (
    <MotiView
      style={[StyleSheet.absoluteFill, styles.overlay]}
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 250 }}
    >
      <MotiView
        from={{ opacity: 0, translateY: 16, scale: 0.98 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={styles.persp}
      >
        {/* 背面（发牌中） */}
        <MotiView
          style={[styles.card, styles.cardBack]}
          animate={{ rotateY: flipped ? '180deg' : '0deg' }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <Text style={styles.dealHint}>正在发牌…</Text>
          <Text style={styles.dealMark}>🂠</Text>
          <Text style={styles.dealHint}>身份仅你可见</Text>
        </MotiView>
        {/* 正面（角色） */}
        <MotiView
          style={[styles.card, styles.cardFront, { borderColor: accent }]}
          animate={{ rotateY: flipped ? '360deg' : '180deg' }}
          transition={{ type: 'timing', duration: 700 }}
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
        </MotiView>
      </MotiView>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  persp: { width: 300, height: 380, transform: [{ perspective: 1200 }] },
  card: {
    position: 'absolute', width: 300, minHeight: 360, borderRadius: 24, padding: 24,
    backgroundColor: wolf.darkSecondary, borderWidth: 2, alignItems: 'center', gap: 10,
    backfaceVisibility: 'hidden',
  },
  cardFront: {},
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
