import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '@/theme';

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'accent'
          ? colors.accent
          : 'transparent';
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.btnText, variant === 'ghost' && { color: colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Avatar({ uri, size = 56 }: { uri?: string | null; size?: number }) {
  return (
    <Image
      source={{ uri: uri ?? 'https://i.pravatar.cc/200' }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2 }}
    />
  );
}

export function Badge({ text, color = colors.primary }: { text: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '33', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function OnlineDot({ online }: { online?: boolean }) {
  return <View style={[styles.dot, { backgroundColor: online ? colors.online : colors.textDim }]} />;
}

export function Screen({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return <View style={[styles.screen, pad && { padding: 16 }]}>{children}</View>;
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

export function Loading() {
  return (
    <Center>
      <ActivityIndicator color={colors.primary} size="large" />
    </Center>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
