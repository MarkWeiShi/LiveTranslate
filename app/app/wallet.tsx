import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { Btn, Loading } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function WalletScreen() {
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['wallet'], queryFn: api.wallet });
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (receipt: string) => {
    setBusy(receipt);
    try {
      await api.iapVerify(receipt);
      await refetch();
      await refreshMe();
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) return <Loading />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Stack.Screen options={{ title: '钱包 / 订阅', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <View style={styles.box}>
        <Text style={styles.big}>💎 {data.diamonds}</Text>
        <Text style={styles.dim}>试用翻译剩余 {data.trialSecondsLeft}s</Text>
        <Text style={styles.dim}>
          订阅：{data.subscriptionTier}
          {data.subscriptionExpiry ? ` (至 ${new Date(data.subscriptionExpiry).toLocaleDateString()})` : ''}
        </Text>
      </View>
      <Btn label="月度订阅（无限翻译）" variant="primary" loading={busy === 'mock_month'} onPress={() => buy('mock_month')} />
      <Btn label="周订阅" variant="ghost" loading={busy === 'mock_week'} onPress={() => buy('mock_week')} />
      <Btn label="买 100 钻石" variant="ghost" loading={busy === 'mock_diamonds_100'} onPress={() => buy('mock_diamonds_100')} />
      <Btn label="买 500 钻石" variant="ghost" loading={busy === 'mock_diamonds_500'} onPress={() => buy('mock_diamonds_500')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 6 },
  big: { color: colors.text, fontSize: 32, fontWeight: '900' },
  dim: { color: colors.textDim, fontSize: 14 },
});
