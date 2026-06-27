import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { wolf } from '@/theme';

// 昼夜底色交叉淡入 + 血红呼吸光晕（移植自 wolfcha GameBackground，用 Moti/Reanimated）。
// isNight=true → 暗夜血色；false → 羊皮纸白天。1.5s 交叉淡入。
export function WolfBackground({ isNight }: { isNight: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 白天底 */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wolf.dayMain }]} />
      {/* 暗夜底（淡入覆盖白天） */}
      <MotiView
        style={[StyleSheet.absoluteFill, { backgroundColor: wolf.dark }]}
        animate={{ opacity: isNight ? 1 : 0 }}
        transition={{ type: 'timing', duration: 1500 }}
      />
      {/* 血红呼吸光晕（夜晚可见，10s 脉动） */}
      <MotiView
        style={styles.glow}
        animate={{ opacity: isNight ? 0.45 : 0, scale: isNight ? 1.12 : 1 }}
        transition={{
          opacity: { type: 'timing', duration: 1500 },
          scale: { type: 'timing', duration: 5000, loop: true, repeatReverse: true },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    width: '70%',
    height: '50%',
    borderRadius: 9999,
    backgroundColor: wolf.blood,
    filter: 'blur(90px)' as unknown as undefined, // web 模糊；原生忽略
  },
});
