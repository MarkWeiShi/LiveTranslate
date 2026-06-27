import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Gender, UserCard } from '@linku/shared';
import { api } from '@/api/endpoints';
import { Avatar, Badge, Btn, Center, Loading, OnlineDot } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function DiscoveryScreen() {
  const router = useRouter();
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [onlineOnly, setOnlineOnly] = useState(true);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['discovery', gender, onlineOnly],
    queryFn: () => api.discovery({ gender, onlineOnly }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.filters}>
        <Filter label="女" active={gender === 'FEMALE'} onPress={() => setGender(gender === 'FEMALE' ? undefined : 'FEMALE')} />
        <Filter label="男" active={gender === 'MALE'} onPress={() => setGender(gender === 'MALE' ? undefined : 'MALE')} />
        <Filter label="仅在线" active={onlineOnly} onPress={() => setOnlineOnly((v) => !v)} />
        <Filter label="🗣 语聊房" onPress={() => router.push('/babel')} />
        <Filter label="🏆 成长" onPress={() => router.push('/growth')} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Center>
              <Text style={{ color: colors.textDim }}>暂无在线用户，下拉刷新或调整筛选。</Text>
            </Center>
          }
          renderItem={({ item }) => <Card u={item} onPress={() => router.push(`/user/${item.id}`)} />}
        />
      )}
    </View>
  );
}

function Filter({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={{ color: active ? '#fff' : colors.textDim, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Card({ u, onPress }: { u: UserCard; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Avatar uri={u.avatarUrl} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.name}>{u.displayName}</Text>
          <OnlineDot online={u.online} />
        </View>
        <Text style={styles.lang}>母语 {u.nativeLanguage.toUpperCase()} · 信任 {u.trustScore}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {u.realPersonVerified && <Badge text="实人" color={colors.online} />}
          <Badge text={u.intent === 'DEEP' ? '深聊' : u.intent === 'LANG_SOCIAL' ? '语言+社交' : '交友'} />
        </View>
      </View>
      <Btn label="📹" variant="primary" onPress={onPress} style={{ paddingHorizontal: 14 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' },
  filter: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  lang: { color: colors.textDim, fontSize: 13 },
});
