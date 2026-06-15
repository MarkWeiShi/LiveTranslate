import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReportReason } from '@linku/shared';
import { api } from '@/api/endpoints';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SCAM_FRAUD', label: '诈骗 / 杀猪盘' },
  { value: 'HARASSMENT', label: '骚扰' },
  { value: 'INAPPROPRIATE', label: '不当内容' },
  { value: 'FAKE_PROFILE', label: '虚假资料' },
  { value: 'OTHER', label: '其他' },
];

export function ReportBlockSheet({
  targetId,
  visible,
  onClose,
  onBlocked,
}: {
  targetId: string;
  visible: boolean;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>('SCAM_FRAUD');
  const [busy, setBusy] = useState(false);

  const submit = async (alsoBlock: boolean) => {
    setBusy(true);
    try {
      await api.report({ targetId, reason });
      if (alsoBlock) {
        await api.block(targetId);
        onBlocked?.();
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>举报 / 拉黑</Text>
          {REASONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              style={[styles.reason, reason === r.value && { borderColor: colors.primary, backgroundColor: colors.surface2 }]}
            >
              <Text style={{ color: colors.text }}>{r.label}</Text>
            </Pressable>
          ))}
          <Btn label="举报并拉黑" variant="danger" loading={busy} onPress={() => submit(true)} style={{ marginTop: 12 }} />
          <Btn label="仅举报" variant="ghost" onPress={() => submit(false)} style={{ marginTop: 8 }} />
          <Btn label="取消" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  reason: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginTop: 6 },
});
