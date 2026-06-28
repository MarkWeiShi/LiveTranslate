import { StyleSheet, Text, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { giftEmoji, BIG_GIFT_COINS } from '@/game/gifts';
import { wolf } from '@/theme';

// 礼物飘屏：小礼物从底部飞入横幅 + 连击数；大礼物中心全屏放大。
export interface GiftFlyItem { id: number; fromName: string; giftType: string; coins: number; combo: number }

export function GiftFly({ items, big }: { items: GiftFlyItem[]; big: GiftFlyItem | null }) {
  return (
    <View style={styles.layer} pointerEvents="none">
      {/* 大礼物全屏 */}
      <AnimatePresence>
        {big && (
          <MotiView
            key={big.id}
            style={styles.bigWrap}
            from={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          >
            <Text style={styles.bigEmoji}>{giftEmoji(big.giftType)}</Text>
            <Text style={styles.bigText}>{big.fromName} 送出 {giftEmoji(big.giftType)}</Text>
          </MotiView>
        )}
      </AnimatePresence>

      {/* 小礼物横幅（左下，最多 3 条） */}
      <View style={styles.banners}>
        <AnimatePresence>
          {items.slice(-3).map((it) => (
            <MotiView
              key={it.id}
              style={styles.banner}
              from={{ translateX: -240, opacity: 0 }}
              animate={{ translateX: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <Text style={styles.bannerText} numberOfLines={1}>{it.fromName} 送出</Text>
              <Text style={styles.bannerEmoji}>{giftEmoji(it.giftType)}</Text>
              {it.combo > 1 && (
                <MotiView key={it.combo} from={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'timing', duration: 180 }}>
                  <Text style={styles.combo}>x{it.combo}</Text>
                </MotiView>
              )}
            </MotiView>
          ))}
        </AnimatePresence>
      </View>
    </View>
  );
}

export { BIG_GIFT_COINS };

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  bigWrap: { position: 'absolute', top: '32%', left: 0, right: 0, alignItems: 'center', gap: 8 },
  bigEmoji: { fontSize: 120 },
  bigText: { color: '#fff', fontWeight: '800', fontSize: 16, textShadowColor: '#000', textShadowRadius: 6 },
  banners: { position: 'absolute', left: 12, bottom: 150, gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: wolf.border },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bannerEmoji: { fontSize: 22 },
  combo: { color: wolf.gold, fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
});
