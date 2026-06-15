import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { SEED_USERS } from '@/config/seedUsers';
import { ENV } from '@/config/env';
import { Btn } from '@/components/ui';
import { colors } from '@/theme';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await login(id);
      const isNew = useAuthStore.getState().isNewUser;
      router.replace(isNew ? '/onboarding' : '/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>LinkU</Text>
      <Text style={styles.tagline}>有了实时翻译，和地球任何一端的人，像聊本地朋友一样深聊。</Text>

      <Btn label="用 HelloTalk 登录" variant="primary" onPress={() => setError('真实 HelloTalk 登录未在 MVP 启用（AUTH=mock）。请用下方开发账号。')} style={{ marginTop: 24 }} />

      {ENV.auth === 'mock' && (
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>开发账号（Mock）</Text>
          {SEED_USERS.map((u) => (
            <Btn
              key={u.id}
              label={`${u.flag}  ${u.label}`}
              variant="ghost"
              loading={busy === u.id}
              onPress={() => pick(u.id)}
              style={{ marginTop: 8 }}
            />
          ))}
          <Text style={styles.hint}>两个浏览器窗口分别登录不同账号即可演示 1v1 翻译视频。</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 80, gap: 6 },
  logo: { color: colors.primary, fontSize: 44, fontWeight: '900', textAlign: 'center' },
  tagline: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  devBox: { marginTop: 28, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
  devTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 12, lineHeight: 18 },
  error: { color: colors.warn, fontSize: 13, marginTop: 16, textAlign: 'center' },
});
