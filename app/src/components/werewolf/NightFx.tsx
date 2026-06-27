import { StyleSheet, Text, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { wolf } from '@/theme';

// 夜间技能全屏特效（移植自 wolfcha NightActionOverlay）：狼爪/解药光环/预言家眼/毒雾/猎人爆裂。
// 由 WerewolfGame 在玩家执行夜间行动时本地触发；fx.id 变化即重放。
export type NightFxType = 'wolf' | 'heal' | 'seer' | 'poison' | 'hunter';
export interface NightFxState { type: NightFxType; id: number }

export function NightFx({ fx }: { fx: NightFxState | null }) {
  return (
    <AnimatePresence>
      {fx && (
        <MotiView
          key={fx.id}
          style={[StyleSheet.absoluteFill, styles.overlay]}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          pointerEvents="none"
        >
          {fx.type === 'wolf' && <Claws />}
          {fx.type === 'heal' && <HealRings />}
          {fx.type === 'seer' && <SeerEye />}
          {fx.type === 'poison' && <PoisonMist />}
          {fx.type === 'hunter' && <HunterBurst />}
        </MotiView>
      )}
    </AnimatePresence>
  );
}

function Claws() {
  return (
    <>
      <MotiView style={[StyleSheet.absoluteFill, { backgroundColor: wolf.blood }]} from={{ opacity: 0.45 }} animate={{ opacity: 0 }} transition={{ type: 'timing', duration: 700 }} />
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          style={[styles.claw, { top: 80 + i * 60 }]}
          from={{ translateX: -520, opacity: 0 }}
          animate={{ translateX: 520, opacity: 1 }}
          transition={{ type: 'timing', duration: 520, delay: i * 110 }}
        />
      ))}
      <Caption emoji="🐺" />
    </>
  );
}

function HealRings() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          style={styles.ring}
          from={{ scale: 0, opacity: 0.85 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ type: 'timing', duration: 1200, delay: i * 220 }}
        />
      ))}
      <Caption emoji="💊" />
    </>
  );
}

function SeerEye() {
  return (
    <>
      <MotiView style={styles.seerGlow} from={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1.4, opacity: 0.7 }} transition={{ type: 'timing', duration: 700 }} />
      <MotiView from={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        <Text style={styles.bigEmoji}>🔮</Text>
      </MotiView>
    </>
  );
}

function PoisonMist() {
  return (
    <>
      <MotiView style={[StyleSheet.absoluteFill, { backgroundColor: wolf.role.WITCH }]} from={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ type: 'timing', duration: 600 }} />
      <Caption emoji="☠️" />
    </>
  );
}

function HunterBurst() {
  return (
    <>
      {['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'].map((rot) => (
        <MotiView
          key={rot}
          style={[styles.ray, { transform: [{ rotate: rot }] }]}
          from={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 0 }}
          transition={{ type: 'timing', duration: 600 }}
        />
      ))}
      <Caption emoji="🔫" />
    </>
  );
}

function Caption({ emoji }: { emoji: string }) {
  return (
    <MotiView style={styles.caption} from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
      <Text style={styles.bigEmoji}>{emoji}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 70 },
  claw: { position: 'absolute', left: 0, width: 260, height: 6, borderRadius: 4, backgroundColor: wolf.bloodLight, transform: [{ rotate: '-30deg' }] },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#3ddc84' },
  seerGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: wolf.role.SEER, filter: 'blur(60px)' as unknown as undefined },
  ray: { position: 'absolute', width: 240, height: 4, backgroundColor: wolf.role.HUNTER, borderRadius: 2 },
  caption: { position: 'absolute' },
  bigEmoji: { fontSize: 88 },
});
