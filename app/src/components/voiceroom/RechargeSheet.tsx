import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { STAR_PACKS, type StarPack } from '@linku/shared';
import { colors, wolf, radius } from '@/theme';

// 充值面板：Telegram Stars（⭐）→ 钻石（💎）。无 Telegram 时走 dev 入账。
interface Props {
  visible: boolean;
  balance: number;
  earnings: number;
  busy: boolean;
  onClose: () => void;
  onPick: (pack: StarPack) => void;
  onWithdraw: () => void;
}

export function RechargeSheet({ visible, balance, earnings, busy, onClose, onPick, onWithdraw }: Props) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <MotiView style={styles.sheet} from={{ translateY: 360 }} animate={{ translateY: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>钱包</Text>
          <Text style={styles.balance}>💎 {balance}</Text>
        </View>
        {/* 收礼收益 + 提现 */}
        <View style={styles.earnRow}>
          <Text style={styles.earnText}>💰 收益 {earnings}</Text>
          <Pressable disabled={busy || earnings <= 0} onPress={onWithdraw} style={[styles.withdrawBtn, (busy || earnings <= 0) && { opacity: 0.4 }]}>
            <Text style={styles.withdrawText}>提现</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>用 Telegram Stars ⭐ 支付到账钻石；钻石用于送礼。收到礼物获得可提现收益。</Text>
        <View style={styles.grid}>
          {STAR_PACKS.map((p) => (
            <Pressable key={p.id} disabled={busy} style={[styles.pack, busy && { opacity: 0.5 }]} onPress={() => onPick(p)}>
              <Text style={styles.packDiamonds}>💎 {p.diamonds}</Text>
              <Text style={styles.packStars}>⭐ {p.stars}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>关闭</Text></Pressable>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#17131a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: 1, borderColor: wolf.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  balance: { color: wolf.gold, fontWeight: '700' },
  earnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  earnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  withdrawBtn: { backgroundColor: colors.online, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 7 },
  withdrawText: { color: '#06301f', fontWeight: '800', fontSize: 13 },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  pack: { width: '47%', alignItems: 'center', paddingVertical: 16, borderRadius: radius.md, borderWidth: 1, borderColor: wolf.gold, backgroundColor: 'rgba(197,160,89,0.1)', gap: 4 },
  packDiamonds: { color: '#fff', fontSize: 18, fontWeight: '800' },
  packStars: { color: wolf.gold, fontSize: 13 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  closeText: { color: '#fff', fontWeight: '700' },
});
