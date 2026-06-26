import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { FamilyDto, GrowthProfileDto } from '@linku/shared';
import { api } from '@/api/endpoints';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function GrowthScreen() {
  const [profile, setProfile] = useState<GrowthProfileDto | null>(null);
  const [bondPeer, setBondPeer] = useState('');
  const [bondMsg, setBondMsg] = useState('');
  const [famName, setFamName] = useState('');
  const [myFamId, setMyFamId] = useState('');
  const [msg, setMsg] = useState('');

  const lb = useQuery({ queryKey: ['family-lb'], queryFn: () => api.familyLeaderboard() });
  const refreshLb = () => lb.refetch();

  useEffect(() => { api.growthMe().then(setProfile).catch(() => {}); }, []);

  const award = async () => {
    try { const r = await api.growthAward(50, 'demo'); setProfile(r); setMsg(r.leveledUp ? '🎉 升级了！' : `+50 XP（Lv.${r.level}）`); } catch { /* ignore */ }
  };
  const bond = async () => {
    if (!bondPeer.trim()) return;
    try { const r = await api.growthBond(bondPeer.trim(), 20); setBondMsg(`亲密度 ${r.intimacy}（Lv.${r.level}）`); } catch (e) { setBondMsg(e instanceof Error ? e.message : '失败'); }
  };
  const createFam = async () => {
    if (!famName.trim()) return;
    try { const f = await api.createFamily(famName.trim()); setMyFamId(f.id); setFamName(''); setMsg(`已创建家族「${f.name}」`); refreshLb(); } catch { /* ignore */ }
  };
  const contribute = async () => {
    if (!myFamId) { setMsg('先创建或加入家族'); return; }
    try { const f = await api.contributeFamily(myFamId, 50); setMsg(`「${f.name}」+50（总分 ${f.score}）`); refreshLb(); } catch (e) { setMsg(e instanceof Error ? e.message : '失败'); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={s.title}>🏆 成长 · CP · 家族</Text>

      {/* 个人成长 */}
      <View style={s.card}>
        <Text style={s.h}>个人成长</Text>
        {profile ? (
          <>
            <Text style={s.big}>Lv.{profile.level} · {profile.xp} XP</Text>
            <Text style={s.dim}>距下一级还差 {profile.toNext} XP</Text>
          </>
        ) : <Text style={s.dim}>加载中…</Text>}
        <Btn label="做任务 +50 XP" variant="primary" onPress={award} style={{ marginTop: 8 }} />
      </View>

      {/* 跨国 CP */}
      <View style={s.card}>
        <Text style={s.h}>跨国 CP 亲密度</Text>
        <TextInput value={bondPeer} onChangeText={setBondPeer} placeholder="对方 userId（发现页用户）" placeholderTextColor={colors.textDim} style={s.input} autoCapitalize="none" />
        <Btn label="互动 +20 亲密度" variant="accent" onPress={bond} />
        {!!bondMsg && <Text style={s.dim}>{bondMsg}</Text>}
      </View>

      {/* 家族战 */}
      <View style={s.card}>
        <Text style={s.h}>家族战</Text>
        <View style={s.row}>
          <TextInput value={famName} onChangeText={setFamName} placeholder="家族名" placeholderTextColor={colors.textDim} style={[s.input, { flex: 1, marginBottom: 0 }]} />
          <Btn label="创建" variant="ghost" onPress={createFam} />
        </View>
        <Btn label="为我的家族贡献 +50" variant="ghost" onPress={contribute} />
        {!!msg && <Text style={s.dim}>{msg}</Text>}
        <Text style={[s.h, { marginTop: 8 }]}>排行榜</Text>
        {(lb.data?.families ?? []).map((f: FamilyDto, i: number) => (
          <Text key={f.id} style={s.lbRow}>{i + 1}. {f.name} · {f.score} 分 · {f.members} 人{f.id === myFamId ? '（我的）' : ''}</Text>
        ))}
        {(lb.data?.families?.length ?? 0) === 0 && <Text style={s.dim}>暂无家族，创建一个吧。</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  h: { color: colors.text, fontWeight: '800', fontSize: 15 },
  big: { color: colors.text, fontSize: 20, fontWeight: '800' },
  dim: { color: colors.textDim, fontSize: 13 },
  input: { color: colors.text, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lbRow: { color: colors.text, fontSize: 13 },
});
