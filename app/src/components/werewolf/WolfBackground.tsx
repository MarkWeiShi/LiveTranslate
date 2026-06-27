import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Easing } from 'react-native';
import { wolf } from '@/theme';

// 昼夜底色交叉淡入 + 血红呼吸光晕（移植自 wolfcha GameBackground，用 RN Animated）。
// isNight=true → 暗夜血色；false → 羊皮纸白天。1.5s 交叉淡入。
export function WolfBackground({ isNight }: { isNight: boolean }) {
  const nightOp = useRef(new Animated.Value(isNight ? 1 : 0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(nightOp, {
      toValue: isNight ? 1 : 0,
      duration: 1500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isNight, nightOp]);

  // 血红光晕呼吸（仅夜晚可见）：10s 循环 scale 脉动
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOpacity = Animated.multiply(nightOp, glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 白天底 */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wolf.dayMain }]} />
      {/* 暗夜底（淡入覆盖白天） */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: wolf.dark, opacity: nightOp }]} />
      {/* 血红呼吸光晕 */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
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
    // web 模糊；原生忽略
    filter: 'blur(90px)' as unknown as undefined,
  },
});
