import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SeatDto } from '@linku/shared';
import { MicSeat, type SeatMember } from './MicSeat';
import { avatarUrl } from '@/game/avatar';
import { wolf } from '@/theme';

// Discord Stage 形态：发言者区（在麦） + 听众区（头像网格）。布局变体，复用同一座位后端。
interface Aud { userId: string; displayName: string }
interface Props {
  seats: SeatDto[];
  audience: Aud[];
  myId?: string;
  isSpeaking: (uid: string | null) => boolean;
  charm: Record<string, number>;
  onSeatPress: (seat: SeatDto) => void;
  onAudiencePress: (a: Aud) => void;
}

export function StageLayout({ seats, audience, myId, isSpeaking, charm, onSeatPress, onAudiencePress }: Props) {
  const speakers = seats.filter((s) => s.userId); // 只显示在麦者（舞台=动态发言者）
  const seatMember = (seat: SeatDto): SeatMember | null => (seat.userId ? { userId: seat.userId, displayName: seat.displayName ?? '' } : null);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
      {/* 发言者区 */}
      <Text style={styles.section}>🎙 发言者 · {speakers.length}</Text>
      <View style={styles.speakerWrap}>
        {speakers.map((seat) => (
          <MicSeat
            key={seat.index}
            seatNo={seat.index}
            member={seatMember(seat)}
            isHost={seat.isHost}
            isMe={seat.userId === myId}
            muted={seat.muted}
            speaking={isSpeaking(seat.userId)}
            charm={seat.userId ? charm[seat.userId] ?? 0 : 0}
            onPress={() => onSeatPress(seat)}
          />
        ))}
      </View>

      {/* 听众区 */}
      <Text style={styles.section}>👥 听众 · {audience.length}</Text>
      {audience.length === 0 ? (
        <Text style={styles.empty}>暂无听众</Text>
      ) : (
        <View style={styles.audWrap}>
          {audience.slice(0, 60).map((a) => (
            <Pressable key={a.userId} style={styles.aud} onPress={() => onAudiencePress(a)}>
              <Image source={{ uri: avatarUrl(a.userId) }} style={styles.audAvatar} />
              <Text style={styles.audName} numberOfLines={1}>{a.displayName}{a.userId === myId ? '·我' : ''}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { color: wolf.gold, fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 6, paddingHorizontal: 14 },
  speakerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 8 },
  empty: { color: 'rgba(255,255,255,0.4)', paddingHorizontal: 16, fontSize: 13 },
  audWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, justifyContent: 'flex-start' },
  aud: { alignItems: 'center', width: 52, gap: 2 },
  audAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  audName: { color: 'rgba(255,255,255,0.8)', fontSize: 10, maxWidth: 52 },
});
