import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  WEREWOLF_EVENTS,
  WEREWOLF_BOARDS,
  type WolfGameOverPayload,
  type WolfHostPayload,
  type WolfPrivatePayload,
  type WolfRolePayload,
  type WolfSpeechPayload,
  type WolfStatePayload,
} from '@linku/shared';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { connectWs, getSocket } from '@/realtime/ws';
import { connectRoomAudio, type RoomAudioHandle } from '@/realtime/livekitAudio';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

const LANGS = [
  { code: 'zh', label: '中文 🇨🇳' },
  { code: 'en', label: 'English 🇺🇸' },
  { code: 'es', label: 'Español 🇪🇸' },
  { code: 'ar', label: 'العربية 🇦🇪' },
];

const PHASE_LABEL: Record<string, string> = {
  lobby: '⏳ 等待开始',
  night: '🌙 夜晚',
  dawn: '🌅 天亮',
  speak: '🗣 发言',
  vote: '🗳 投票',
  over: '🏁 结束',
};

export default function WerewolfScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);

  const [lang, setLang] = useState('zh');
  const [boardKey, setBoardKey] = useState('newbie6');
  const [gameInput, setGameInput] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);

  const [state, setState] = useState<WolfStatePayload | null>(null);
  const [role, setRole] = useState<WolfRolePayload | null>(null);
  const [prompt, setPrompt] = useState<WolfPrivatePayload | null>(null);
  const [hostLines, setHostLines] = useState<WolfHostPayload[]>([]);
  const [speeches, setSpeeches] = useState<WolfSpeechPayload[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [over, setOver] = useState<WolfGameOverPayload | null>(null);

  const [speakText, setSpeakText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<RoomAudioHandle | null>(null);
  const feedRef = useRef<ScrollView>(null);

  const mySeat = state?.seats.find((s) => s.userId === myId) ?? null;
  const isHost = !!state && !!myId && state.hostUserId === myId;
  const myTurn = !!state && state.phase === 'speak' && !!mySeat && state.currentSpeakerSeat === mySeat.seatNo && mySeat.alive;
  const canVote = !!state && state.phase === 'vote' && !!mySeat && mySeat.alive;

  useEffect(() => {
    if (token && !getSocket()) connectWs(token);
  }, [token]);
  useEffect(() => () => { audioRef.current?.disconnect(); audioRef.current = null; }, []);

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();
    if (!socket) return;
    const mine = (id: string) => id === gameId;
    const onState = (p: WolfStatePayload) => { if (mine(p.gameId)) setState(p); };
    const onRole = (p: WolfRolePayload) => { if (mine(p.gameId)) setRole(p); };
    const onPrivate = (p: WolfPrivatePayload) => {
      if (!mine(p.gameId)) return;
      if (p.kind === 'night_action' || p.kind === 'hunter_shot') setPrompt(p);
      else setNotices((n) => [...n, p.text].slice(-8));
    };
    const onHost = (p: WolfHostPayload) => {
      if (!mine(p.gameId)) return;
      setHostLines((h) => [...h, p].slice(-60));
      requestAnimationFrame(() => feedRef.current?.scrollToEnd({ animated: true }));
    };
    const onSpeech = (p: WolfSpeechPayload) => {
      if (!mine(p.gameId)) return;
      setSpeeches((s) => [...s, p].slice(-80));
      requestAnimationFrame(() => feedRef.current?.scrollToEnd({ animated: true }));
    };
    const onOver = (p: WolfGameOverPayload) => { if (mine(p.gameId)) { setOver(p); setPrompt(null); } };

    socket.on(WEREWOLF_EVENTS.STATE, onState);
    socket.on(WEREWOLF_EVENTS.ROLE, onRole);
    socket.on(WEREWOLF_EVENTS.PRIVATE, onPrivate);
    socket.on(WEREWOLF_EVENTS.HOST, onHost);
    socket.on(WEREWOLF_EVENTS.SPEECH, onSpeech);
    socket.on(WEREWOLF_EVENTS.GAME_OVER, onOver);
    return () => {
      socket.off(WEREWOLF_EVENTS.STATE, onState);
      socket.off(WEREWOLF_EVENTS.ROLE, onRole);
      socket.off(WEREWOLF_EVENTS.PRIVATE, onPrivate);
      socket.off(WEREWOLF_EVENTS.HOST, onHost);
      socket.off(WEREWOLF_EVENTS.SPEECH, onSpeech);
      socket.off(WEREWOLF_EVENTS.GAME_OVER, onOver);
    };
  }, [gameId]);

  // 阶段切换时清掉过期的私密提示
  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'night' && prompt?.action !== 'HUNTER_SHOT') setPrompt(null);
  }, [state?.phase]);

  async function enter() {
    setBusy(true); setError(null);
    try {
      let id = gameInput.trim();
      let mediaToken: string;
      if (!id) {
        const res = await api.wolfCreate(boardKey, lang);
        id = res.gameId; mediaToken = res.token;
      } else {
        const res = await api.wolfJoin(id, lang);
        mediaToken = res.token;
      }
      setGameId(id);
      connectRoomAudio(mediaToken).then((h) => { audioRef.current = h; }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '进入失败');
    } finally { setBusy(false); }
  }

  const start = async () => { if (gameId) try { await api.wolfStart(gameId); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const sendSpeak = async () => { const t = speakText.trim(); if (!t || !gameId) return; setSpeakText(''); try { await api.wolfSpeak(gameId, t); } catch { /* ignore */ } };
  const pass = async () => { if (gameId) try { await api.wolfPass(gameId); } catch { /* ignore */ } };
  const castVote = async (seatNo: number | null) => { if (gameId) try { await api.wolfVote(gameId, seatNo); } catch { /* ignore */ } };
  const act = async (body: { action: WolfPrivatePayload['action']; targetSeat?: number; save?: boolean; poisonSeat?: number }) => {
    if (!gameId || !body.action) return;
    try { await api.wolfNightAction(gameId, { action: body.action, targetSeat: body.targetSeat, save: body.save, poisonSeat: body.poisonSeat }); setPrompt(null); } catch { /* ignore */ }
  };
  const leave = async () => { audioRef.current?.disconnect(); if (gameId) { try { await api.wolfLeave(gameId); } catch { /* ignore */ } } router.back(); };

  // ---------- 进入前 ----------
  if (!gameId) {
    return (
      <View style={s.container}>
        <Text style={s.title}>🐺 跨语言狼人杀</Text>
        <Text style={s.sub}>各说母语、同局博弈。AI 当上帝（多语言旁白）+ 人数不足自动补 AI 玩家。</Text>
        <Text style={s.label}>我的语言</Text>
        <View style={s.row}>{LANGS.map((l) => <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />)}</View>
        <Text style={s.label}>板子</Text>
        <View style={s.row}>{Object.values(WEREWOLF_BOARDS).map((b) => <Chip key={b.key} label={b.name} active={boardKey === b.key} onPress={() => setBoardKey(b.key)} />)}</View>
        <Text style={s.label}>对局号（留空＝新建）</Text>
        <TextInput value={gameInput} onChangeText={setGameInput} placeholder="粘贴对局号加入，或留空新建" placeholderTextColor={colors.textDim} style={s.input} autoCapitalize="none" />
        {error && <Text style={s.error}>{error}</Text>}
        <Btn label={busy ? '进入中…' : '进入对局'} variant="primary" onPress={enter} style={{ marginTop: 16 }} />
        <Text style={s.hint}>单人也可玩：新建后直接「开始」，空位由 AI 玩家补满，你能看到 AI 用各自语言发言被翻成你的母语。</Text>
      </View>
    );
  }

  // ---------- 对局内 ----------
  const aliveSeats = state?.seats.filter((x) => x.alive) ?? [];
  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.roomTitle}>{state ? PHASE_LABEL[state.phase] : '…'} {state && state.day > 0 ? `· 第${state.day}天` : ''}</Text>
        <Btn label="离开" variant="ghost" onPress={leave} />
      </View>
      <Text selectable style={s.roomIdLine}>对局号：{gameId}（复制到另一窗口加入）{state?.containsAI ? ' · 含 AI 玩家' : ''}</Text>

      {/* 角色卡 */}
      {role && (
        <View style={[s.gameCard, { borderColor: role.camp === 'WOLF' ? colors.danger : colors.primary }]}>
          <Text style={s.gameTitle}>你的身份：{role.roleName}（{role.seatNo}号）</Text>
          <Text style={s.gameHeard}>{role.roleDesc}</Text>
          {role.teammates && role.teammates.length > 0 && (
            <Text style={s.gameHeard}>狼队友：{role.teammates.map((t) => `${t.seatNo}号 ${t.displayName}`).join('、')}</Text>
          )}
        </View>
      )}

      {/* 座位 */}
      <View style={s.row}>
        {state?.seats.map((m) => {
          const speaking = state.currentSpeakerSeat === m.seatNo;
          return (
            <View key={m.seatNo} style={[s.member, !m.alive && s.dead, speaking && s.speaking]}>
              <Text style={s.memberName}>{m.seatNo}号 {m.displayName}{m.userId === myId ? '（你）' : ''}</Text>
              <Text style={s.memberLang}>{m.alive ? (speaking ? '🎙 发言中' : '存活') : '☠️ 出局'}</Text>
            </View>
          );
        })}
      </View>

      {/* 大厅：开始 */}
      {state?.phase === 'lobby' && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>等待开始（{state.seats.length}/{WEREWOLF_BOARDS[state.boardKey]?.size} 人）</Text>
          {isHost ? <Btn label="开始对局（空位补 AI）" variant="primary" onPress={start} /> : <Text style={s.gameHeard}>等房主开始…</Text>}
        </View>
      )}

      {/* 私密行动提示（夜间 / 猎人） */}
      {prompt && (
        <View style={[s.gameCard, { borderColor: colors.accent }]}>
          <Text style={s.gameTitle}>🔒 {prompt.text}</Text>
          {prompt.action === 'WITCH' ? (
            <View style={{ gap: 6 }}>
              {prompt.canSave && <Btn label="💊 使用解药救人" variant="accent" onPress={() => act({ action: 'WITCH', save: true })} />}
              {prompt.canPoison && (
                <>
                  <Text style={s.gameHeard}>或选择下毒目标：</Text>
                  <View style={s.row}>{prompt.targets?.map((t) => <Chip key={t.seatNo} label={`☠️ ${t.seatNo}号`} onPress={() => act({ action: 'WITCH', poisonSeat: t.seatNo })} />)}</View>
                </>
              )}
              <Btn label="跳过（不用药）" variant="ghost" onPress={() => act({ action: 'WITCH' })} />
            </View>
          ) : (
            <View style={s.row}>{prompt.targets?.map((t) => <Chip key={t.seatNo} label={`${t.seatNo}号 ${t.displayName}`} onPress={() => act({ action: prompt.action, targetSeat: t.seatNo })} />)}</View>
          )}
        </View>
      )}

      {/* 投票 */}
      {canVote && (
        <View style={[s.gameCard, { borderColor: colors.primary }]}>
          <Text style={s.gameTitle}>🗳 投票放逐谁？</Text>
          <View style={s.row}>
            {aliveSeats.filter((x) => x.userId !== myId).map((t) => {
              const tally = state?.voteTally?.find((v) => v.seatNo === t.seatNo)?.votes ?? 0;
              return <Chip key={t.seatNo} label={`${t.seatNo}号${tally ? ` (${tally})` : ''}`} onPress={() => castVote(t.seatNo)} />;
            })}
            <Chip label="弃票" onPress={() => castVote(null)} />
          </View>
        </View>
      )}

      {/* 个人通知（查验结果/死亡等） */}
      {notices.length > 0 && (
        <View style={s.noticeBar}>
          {notices.slice(-3).map((n, i) => <Text key={i} style={s.noticeItem}>🔔 {n}</Text>)}
        </View>
      )}

      {/* 旁白 + 发言流 */}
      <ScrollView ref={feedRef} style={s.feed} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {hostLines.length === 0 && speeches.length === 0 && (
          <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 24 }}>对局开始后，这里显示主持旁白与跨语言发言字幕。</Text>
        )}
        {interleave(hostLines, speeches).map((item, i) =>
          'text' in item && !('fromSeat' in item) ? (
            <Text key={`h${i}`} style={s.hostLine}>🎙 {(item as WolfHostPayload).text}</Text>
          ) : (
            <View key={`s${i}`} style={s.bubble}>
              <Text style={s.from}>{(item as WolfSpeechPayload).fromSeat}号 {(item as WolfSpeechPayload).fromName} · {(item as WolfSpeechPayload).originalLang}→{(item as WolfSpeechPayload).targetLang}</Text>
              <Text style={s.translated}>{(item as WolfSpeechPayload).translatedText}</Text>
              {(item as WolfSpeechPayload).originalText !== (item as WolfSpeechPayload).translatedText && (
                <Text style={s.original}>{(item as WolfSpeechPayload).originalText}</Text>
              )}
            </View>
          ),
        )}
      </ScrollView>

      {/* 发言输入（轮到你时） */}
      {myTurn && (
        <View style={s.sendRow}>
          <TextInput value={speakText} onChangeText={setSpeakText} placeholder={`轮到你发言（${lang}）…`} placeholderTextColor={colors.textDim} style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={sendSpeak} />
          <Btn label="发言" variant="primary" onPress={sendSpeak} />
          <Btn label="过麦" variant="ghost" onPress={pass} />
        </View>
      )}

      {/* 结算 */}
      {over && (
        <View style={[s.gameCard, { borderColor: over.winner === 'WOLF' ? colors.danger : colors.primary }]}>
          <Text style={s.gameTitle}>🏁 {over.winner === 'WOLF' ? '狼人胜利' : '好人胜利'}</Text>
          {over.reveal.map((r) => (
            <Text key={r.seatNo} style={s.chainLine}>{r.seatNo}号 {r.displayName} — {r.role}{r.isAI ? ' 🤖AI' : ''}{r.alive ? '' : ' ☠️'}</Text>
          ))}
          <Btn label="返回" variant="ghost" onPress={leave} style={{ marginTop: 8 }} />
        </View>
      )}
    </View>
  );
}

// 按时间戳交错合并旁白与发言
function interleave(host: WolfHostPayload[], speech: WolfSpeechPayload[]): (WolfHostPayload | WolfSpeechPayload)[] {
  return [...host, ...speech].sort((a, b) => a.ts - b.ts).slice(-80);
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Text onPress={onPress} style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary, color: '#fff' }]}>{label}</Text>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
  sub: { color: colors.textDim, marginBottom: 8 },
  label: { color: colors.textDim, fontSize: 13, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { color: colors.textDim, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, overflow: 'hidden', fontWeight: '700', fontSize: 13 },
  input: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  error: { color: colors.danger, marginTop: 6 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 16, lineHeight: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  roomTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  roomIdLine: { color: colors.textDim, fontSize: 12 },
  member: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'transparent' },
  dead: { opacity: 0.4 },
  speaking: { borderColor: colors.accent },
  memberName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  memberLang: { color: colors.textDim, fontSize: 11 },
  gameCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: 12, gap: 6 },
  gameTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  gameHeard: { color: colors.textDim, fontSize: 13 },
  chainLine: { color: colors.text, fontSize: 13 },
  noticeBar: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 8, gap: 2 },
  noticeItem: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  feed: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, marginTop: 4 },
  hostLine: { color: colors.textDim, fontSize: 13, fontStyle: 'italic' },
  bubble: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12 },
  from: { color: colors.textDim, fontSize: 11, marginBottom: 4 },
  translated: { color: colors.text, fontSize: 17, fontWeight: '700' },
  original: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
});
