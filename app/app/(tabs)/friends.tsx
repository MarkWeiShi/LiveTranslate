import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { Avatar, Center, Loading, OnlineDot } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['friends'], queryFn: api.friends });

  if (isLoading) return <Loading />;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      data={data ?? []}
      keyExtractor={(f) => f.friendshipId}
      ListEmptyComponent={
        <Center>
          <Text style={{ color: colors.textDim }}>还没有好友。通话后可加为好友。</Text>
        </Center>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/user/${item.id}`)}>
          <Avatar uri={item.avatarUrl} size={48} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={styles.name}>{item.displayName}</Text>
              <OnlineDot online={item.online} />
            </View>
            <Text style={styles.sub}>母语 {item.nativeLanguage.toUpperCase()}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 13 },
});
