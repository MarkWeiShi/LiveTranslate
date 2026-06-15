import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Avatar, Badge, Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function ProfileScreen() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  if (!me) return null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={styles.header}>
        <Avatar uri={me.avatarUrl} size={88} />
        <Text style={styles.name}>{me.displayName}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {me.realPersonVerified && <Badge text="实人认证" color={colors.online} />}
          <Badge text={`母语 ${me.nativeLanguage.toUpperCase()}`} />
        </View>
      </View>

      <View style={styles.box}>
        <Row label="意图" value={me.intent} />
        <Row label="信任分" value={String(me.trustScore)} />
        <Row label="试用翻译剩余" value={`${me.wallet.trialSecondsLeft}s`} />
        <Row label="订阅" value={me.wallet.subscriptionTier} />
        <Row label="钻石" value={String(me.wallet.diamonds)} />
      </View>

      <Btn label="钱包 / 订阅" variant="ghost" onPress={() => router.push('/wallet')} />
      <Btn label="退出登录" variant="danger" onPress={() => { logout(); router.replace('/login'); }} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.textDim }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
