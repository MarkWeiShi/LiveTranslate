import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { useCallStore } from '@/stores/callStore';
import { Avatar, Btn } from '@/components/ui';
import { colors } from '@/theme';

export function IncomingCallModal() {
  const incoming = useCallStore((s) => s.incoming);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const startActive = useCallStore((s) => s.startActive);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setIncoming(null), 30_000); // ring timeout
    return () => clearTimeout(t);
  }, [incoming, setIncoming]);

  if (!incoming) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await api.acceptCall(incoming.callId);
      startActive({
        callId: incoming.callId,
        room: incoming.room,
        peer: incoming.caller,
        mode: incoming.mode,
        isCaller: false,
      });
      router.push(`/call/${incoming.callId}`);
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    setBusy(true);
    try {
      await api.declineCall(incoming.callId).catch(() => undefined);
      setIncoming(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.label}>来电 · Incoming {incoming.mode === 'VIDEO' ? '视频' : '语音'}</Text>
          <Avatar uri={incoming.caller.avatarUrl} size={96} />
          <Text style={styles.name}>{incoming.caller.displayName}</Text>
          <Text style={styles.sub}>
            {incoming.caller.nativeLanguage.toUpperCase()} · 实时翻译已就绪
          </Text>
          <View style={styles.row}>
            <Btn label="拒接" variant="danger" onPress={decline} disabled={busy} style={{ flex: 1 }} />
            <Btn label="接听" variant="primary" onPress={accept} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12 },
  label: { color: colors.textDim, fontSize: 13 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
});
