import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { GIFTS, type GiftDef } from '@/game/gifts';
import { colors, wolf, radius } from '@/theme';

// BIGO 式礼物面板：底部上滑、礼物网格、余额、赠送。受赠目标由父组件传入名字。
interface Props {
  visible: boolean;
  balance: number;
  targetName: string;
  onClose: () => void;
  onSend: (g: GiftDef) => void;
}

export function GiftPanel({ visible, balance, targetName, onClose, onSend }: Props) {
  const [sel, setSel] = useState<string>(GIFTS[0].type);
  if (!visible) return null;
  const selGift = GIFTS.find((g) => g.type === sel) ?? GIFTS[0];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <MotiView
        style={styles.sheet}
        from={{ translateY: 320 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>送给 {targetName}</Text>
          <Text style={styles.balance}>💎 {balance}</Text>
        </View>
        <View style={styles.grid}>
          {GIFTS.map((g) => (
            <Pressable key={g.type} onPress={() => setSel(g.type)} style={[styles.gift, sel === g.type && styles.giftSel]}>
              <Text style={styles.giftEmoji}>{g.emoji}</Text>
              <Text style={styles.giftName}>{g.name}</Text>
              <Text style={styles.giftPrice}>💎 {g.coins}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.sendBtn} onPress={() => onSend(selGift)}>
          <Text style={styles.sendText}>赠送 · 💎 {selGift.coins}</Text>
        </Pressable>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#17131a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: 1, borderColor: wolf.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 15 },
  balance: { color: wolf.gold, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  gift: { width: '31%', alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.05)', gap: 2 },
  giftSel: { borderColor: wolf.gold, backgroundColor: 'rgba(197,160,89,0.12)' },
  giftEmoji: { fontSize: 30 },
  giftName: { color: '#fff', fontSize: 12 },
  giftPrice: { color: wolf.gold, fontSize: 11 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
