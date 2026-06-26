import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/stores/authStore';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { reportTelegramLaunch } from '@/telegram/launchAttribution';
import { colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function useAuthGate() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!hydrated) return;
    const onLogin = segments[0] === 'login';
    // Only guard unauthenticated access; post-login navigation is handled by the login screen
    // (so new users can be routed to /onboarding without a redirect race).
    if (!token && !onLogin) router.replace('/login');
  }, [token, hydrated, segments, router]);
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  // H5：Telegram 内启动则上报归因（非 Telegram 环境无操作）。
  useEffect(() => {
    void reportTelegramLaunch();
  }, []);
  useAuthGate();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {!hydrated ? (
          <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
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
