import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { avatarUrl } from '@/game/avatar';
import { colors, wolf } from '@/theme';

// BIGO 式麦位：头像 + 昵称 + 麦序 + 静音图标 + 魅力值 + 说话波纹。房主金环更大。
export interface SeatMember { userId: string | null; displayName: string }
interface Props {
  seatNo: number;
  member?: SeatMember | null;
  isHost?: boolean;
  isMe?: boolean;
  speaking?: boolean;
  muted?: boolean;
  locked?: boolean;
  charm?: number;
  onPress?: () => void;
}

export function MicSeat({ seatNo, member, isHost, isMe, speaking, muted, locked, charm = 0, onPress }: Props) {
  const size = isHost ? 64 : 52;
  const ring = isHost ? wolf.gold : speaking ? colors.online : 'rgba(255,255,255,0.15)';
  const occupied = !!member;

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <View style={{ width: size + 16, height: size + 16, alignItems: 'center', justifyContent: 'center' }}>
        {/* 说话波纹 */}
        {speaking && occupied && [0, 1].map((i) => (
          <MotiView
            key={i}
            style={[styles.ripple, { width: size, height: size, borderRadius: size / 2 }]}
            from={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ type: 'timing', duration: 1400, loop: true, delay: i * 700 }}
          />
        ))}
        {/* 头像 / 空位 */}
        {occupied ? (
          <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: ring, borderWidth: isHost || speaking ? 2 : 1 }]}>
            <Image source={{ uri: avatarUrl(member!.userId ?? `seat-${seatNo}`) }} style={styles.img} />
          </View>
        ) : (
          <View style={[styles.empty, { width: size, height: size, borderRadius: size / 2 }, locked && { borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={styles.plus}>{locked ? '🔒' : '＋'}</Text>
          </View>
        )}
        {/* 静音角标 */}
        {occupied && muted && <View style={styles.muteBadge}><Text style={styles.muteIcon}>🔇</Text></View>}
        {/* 房主标 */}
        {isHost && <View style={styles.hostBadge}><Text style={styles.hostText}>房主</Text></View>}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {occupied ? `${member!.displayName}${isMe ? '·我' : ''}` : locked ? '已锁' : `${seatNo} 号`}
      </Text>
      {occupied && (
        <Text style={styles.charm}>💎 {charm}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72, gap: 2 },
  ripple: { position: 'absolute', backgroundColor: colors.online },
  avatar: { overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)' },
  img: { width: '100%', height: '100%' },
  empty: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  plus: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '300' },
  muteBadge: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 3 },
  muteIcon: { fontSize: 11 },
  hostBadge: { position: 'absolute', top: -2, backgroundColor: wolf.gold, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  hostText: { color: '#1a1614', fontSize: 9, fontWeight: '800' },
  name: { color: '#fff', fontSize: 11, fontWeight: '600', maxWidth: 72 },
  charm: { color: wolf.gold, fontSize: 10 },
});
