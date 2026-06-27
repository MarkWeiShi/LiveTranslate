import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/stores/authStore';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { reportTelegramLaunch, getTelegramInitData } from '@/telegram/launchAttribution';
import { colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function useAuthGate(blockRedirect: boolean) {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!hydrated) return;
    const onLogin = segments[0] === 'login';
    // Telegram 自动登录进行中(blockRedirect)时不跳 /login，避免闪现登录页。
    if (!token && !onLogin && !blockRedirect) router.replace('/login');
  }, [token, hydrated, segments, router, blockRedirect]);
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const loginTelegram = useAuthStore((s) => s.loginTelegram);

  // 一次性判定是否在 Telegram Mini App（拿到 initData）
  const [tgInit] = useState(() => getTelegramInitData());
  const [tgFailed, setTgFailed] = useState(false);
  const tgPending = !!tgInit && !token && !tgFailed;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 启动归因（非 Telegram 环境无操作）
  useEffect(() => {
    void reportTelegramLaunch();
  }, []);

  // Telegram 自动登录：拿 initData 换 JWT，跳过开发账号选择器
  useEffect(() => {
    if (!hydrated || token || !tgInit) return;
    let cancelled = false;
    loginTelegram(tgInit).catch(() => {
      if (!cancelled) setTgFailed(true); // 失败则回落到 /login
    });
    return () => { cancelled = true; };
  }, [hydrated, token, tgInit, loginTelegram]);

  useAuthGate(tgPending);

  const showSpinner = !hydrated || tgPending;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {showSpinner ? (
          <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.primary} size="large" />
            {tgPending && <Text style={{ color: colors.textDim }}>正在用 Telegram 账号登录…</Text>}
          </View>
        ) : (
          <>
            <Slot />
            <RealtimeBridge />
            <IncomingCallModal />
          </>
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
