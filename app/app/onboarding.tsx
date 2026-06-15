import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Intent } from '@linku/shared';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: 'SOCIAL', label: '交友' },
  { value: 'DEEP', label: '深度交流' },
  { value: 'LANG_SOCIAL', label: '语言 + 社交' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Intent>('SOCIAL');
  const [perm, setPerm] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [busy, setBusy] = useState(false);

  const requestPerms = async () => {
    if (Platform.OS !== 'web') {
      setPerm('granted');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPerm('granted');
    } catch {
      setPerm('denied');
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await api.updateMe({ intent });
      await refreshMe();
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.title}>欢迎，{me?.displayName ?? ''} 👋</Text>
      <Text style={styles.step}>步骤 {step + 1} / 3</Text>

      {step === 0 && (
        <View style={styles.box}>
          <Text style={styles.q}>你来这里想要…</Text>
          {INTENT_OPTIONS.map((o) => (
            <Btn
              key={o.value}
              label={o.label}
              variant={intent === o.value ? 'primary' : 'ghost'}
              onPress={() => setIntent(o.value)}
              style={{ marginTop: 8 }}
            />
          ))}
          <Btn label="下一步" variant="accent" onPress={() => setStep(1)} style={{ marginTop: 20 }} />
        </View>
      )}

      {step === 1 && (
        <View style={styles.box}>
          <Text style={styles.q}>你的母语</Text>
          <Text style={styles.value}>{me?.nativeLanguage?.toUpperCase()} — 对方说话会实时翻译成它</Text>
          <Btn label="下一步" variant="accent" onPress={() => setStep(2)} style={{ marginTop: 20 }} />
        </View>
      )}

      {step === 2 && (
        <View style={styles.box}>
          <Text style={styles.q}>开启相机与麦克风</Text>
          <Text style={styles.value}>视频通话需要授权。</Text>
          <Btn label={perm === 'granted' ? '✓ 已授权' : '请求权限'} variant="ghost" onPress={requestPerms} style={{ marginTop: 12 }} />
          {perm === 'denied' && <Text style={styles.warn}>未授权，可稍后在浏览器设置开启。</Text>}
          <Btn label="进入 LinkU" variant="primary" loading={busy} onPress={finish} style={{ marginTop: 20 }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 72 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  step: { color: colors.textDim, marginTop: 6, marginBottom: 20 },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 },
  q: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  value: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  warn: { color: colors.warn, fontSize: 13, marginTop: 10 },
});
