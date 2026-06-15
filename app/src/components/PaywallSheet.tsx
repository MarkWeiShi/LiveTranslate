import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

// Shown when translation.paywall fires (trial exhausted) or user toggles translation w/o budget.
export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (receipt: string) => {
    setBusy(receipt);
    try {
      await api.iapVerify(receipt);
      await refreshMe();
      onClose(); // backend resumes the paywalled call (AC-PAY-2)
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>试用翻译已用完</Text>
          <Text style={styles.sub}>订阅后可无限使用实时语音翻译。通话仍在继续，仅暂停了翻译。</Text>
          <Btn label="月度订阅（解锁无限翻译）" variant="primary" loading={busy === 'mock_month'} onPress={() => buy('mock_month')} style={{ marginTop: 12 }} />
          <Btn label="周订阅" variant="ghost" loading={busy === 'mock_week'} onPress={() => buy('mock_week')} style={{ marginTop: 8 }} />
          <Btn label="买 100 钻石（送礼用）" variant="ghost" loading={busy === 'mock_diamonds_100'} onPress={() => buy('mock_diamonds_100')} style={{ marginTop: 8 }} />
          <Btn label="继续无翻译通话" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 19 },
});
