import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { CallMode } from '@linku/shared';
import { api } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { Avatar, Badge, Btn, Loading } from '@/components/ui';
import { ReportBlockSheet } from '@/components/ReportBlockSheet';
import { colors, radius } from '@/theme';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useAuthStore((s) => s.me);
  const startActive = useCallStore((s) => s.startActive);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  const { data: u, isLoading, refetch } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.user(id!),
    enabled: !!id,
  });

  if (isLoading || !u) return <Loading />;

  const blocked = !!u.blocked;
  const offline = u.online === false;

  const startCall = async (mode: CallMode) => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.createCall(u.id, mode);
      startActive({ callId: res.callId, room: res.room, peer: u, mode, isCaller: true });
      router.push(`/call/${res.callId}`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.code === 'CALLEE_UNAVAILABLE'
            ? '对方当前不在线或忙碌'
            : e.code === 'BLOCKED'
              ? '你们之间已拉黑，无法通话'
              : e.code === 'ALREADY_IN_CALL'
                ? '你已在一通通话中'
                : e.message
          : '呼叫失败';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const langHint = me ? `TA 说 ${u.nativeLanguage.toUpperCase()}，你将实时听到 ${me.nativeLanguage.toUpperCase()}` : '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Stack.Screen options={{ title: u.displayName, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar uri={u.avatarUrl} size={120} />
        <Text style={styles.name}>{u.displayName}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {u.realPersonVerified && <Badge text="实人认证" color={colors.online} />}
          <Badge text={`信任 ${u.trustScore}`} />
          {u.online ? <Badge text="在线" color={colors.online} /> : <Badge text="离线" color={colors.textDim} />}
        </View>
      </View>

      {!!langHint && <Text style={styles.langHint}>🌐 {langHint}</Text>}
      {!!u.bio && <Text style={styles.bio}>{u.bio}</Text>}
      {u.interests.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {u.interests.map((i) => (
            <Badge key={i} text={i} color={colors.accent} />
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ gap: 10, marginTop: 8 }}>
        <Btn label="📹 视频通话" variant="primary" disabled={blocked || offline} loading={busy} onPress={() => startCall('VIDEO')} />
        <Btn label="🎙 语音通话" variant="ghost" disabled={blocked || offline} onPress={() => startCall('VOICE')} />
        <Btn label="举报 / 拉黑" variant="ghost" onPress={() => setSheet(true)} />
      </View>

      <ReportBlockSheet
        targetId={u.id}
        visible={sheet}
        onClose={() => setSheet(false)}
        onBlocked={() => {
          void refetch();
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  langHint: { color: colors.primary, fontSize: 14, backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, overflow: 'hidden' },
  bio: { color: colors.textDim, fontSize: 15, lineHeight: 22 },
  error: { color: colors.warn, fontSize: 13 },
});
