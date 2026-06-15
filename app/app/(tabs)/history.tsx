import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { Avatar, Center, Loading } from '@/components/ui';
import { colors, radius } from '@/theme';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['history'], queryFn: api.history });

  if (isLoading) return <Loading />;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      data={data ?? []}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={
        <Center>
          <Text style={{ color: colors.textDim }}>还没有通话记录。</Text>
        </Center>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => item.peer && router.push(`/user/${item.peer.id}`)}>
          <Avatar uri={item.peer?.avatarUrl} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.peer?.displayName ?? '未知用户'}</Text>
            <Text style={styles.sub}>
              {item.mode === 'VIDEO' ? '📹 视频' : '🎙 语音'} · {item.status} · 时长 {fmt(item.durationSec)}
            </Text>
          </View>
          <Text style={styles.xlated}>翻译 {fmt(item.translatedSec)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  xlated: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
