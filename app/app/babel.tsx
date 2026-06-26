import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROOM_EVENTS,
  type QueueEntry,
  type RoomBarragePayload,
  type RoomCaptionPayload,
  type RoomMemberDto,
  type RoomMemberJoinedPayload,
  type RoomMemberLeftPayload,
  type RoomQueuePayload,
  type TelephoneResultPayload,
  type TelephoneTurnPayload,
  type QuizQuestionPayload,
  type QuizResultPayload,
} from '@linku/shared';
import { api } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { connectWs, getSocket } from '@/realtime/ws';
import { connectRoomAudio, type RoomAudioHandle } from '@/realtime/livekitAudio';
import { ENV } from '@/config/env';
import { Btn } from '@/components/ui';
import { colors, radius } from '@/theme';

const LANGS: { code: string; label: string }[] = [
  { code: 'zh', label: '中文 🇨🇳' },
  { code: 'es', label: 'Español 🇪🇸' },
  { code: 'en', label: 'English 🇺🇸' },
  { code: 'ar', label: 'العربية 🇦🇪' },
];
const PHRASES: Record<string, string[]> = {
  zh: ['你好，很高兴认识你！', '你今天过得怎么样？', '我喜欢旅行和摄影。', '你最喜欢哪种音乐？', '希望以后能去你的城市看看。'],
  en: ['Hi, nice to meet you!', 'How was your day?', 'I love traveling and photography.', 'What kind of music do you like?', 'I hope to visit your city someday.'],
  es: ['¡Hola, mucho gusto!', '¿Qué tal tu día?', 'Me encanta viajar y la fotografía.', '¿Qué tipo de música te gusta?', 'Espero poder visitar tu ciudad algún día.'],
  ar: ['مرحبا، سعيد بلقائك!', 'كيف كان يومك؟', 'أحب السفر والتصوير.', 'ما نوع الموسيقى التي تحبها؟', 'آمل أن أزور مدينتك يوما ما.'],
};

export default function BabelRoomScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);

  const [lang, setLang] = useState('zh');
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMemberDto[]>([]);
  const [captions, setCaptions] = useState<RoomCaptionPayload[]>([]);
  const [barrages, setBarrages] = useState<RoomBarragePayload[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [telTurn, setTelTurn] = useState<TelephoneTurnPayload | null>(null);
  const [telResult, setTelResult] = useState<TelephoneResultPayload | null>(null);
  const [quizQ, setQuizQ] = useState<QuizQuestionPayload | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResultPayload | null>(null);
  const [answered, setAnswered] = useState(false);
  const [text, setText] = useState('');
  const [passText, setPassText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<RoomAudioHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handUp = !!myId && queue.some((q) => q.userId === myId);

  useEffect(() => {
    if (token && !getSocket()) connectWs(token);
  }, [token]);

  // 离开页面时断开音频
  useEffect(() => () => { audioRef.current?.disconnect(); audioRef.current = null; }, []);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;
    const onCaption = (p: RoomCaptionPayload) => {
      if (p.roomId !== roomId) return;
      setCaptions((c) => [...c, p].slice(-100));
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };
    const onJoined = (p: RoomMemberJoinedPayload) => {
      if (p.roomId !== roomId) return;
      setMembers((m) => (m.some((x) => x.userId === p.member.userId) ? m : [...m, p.member]));
    };
    const onLeft = (p: RoomMemberLeftPayload) => {
      if (p.roomId !== roomId) return;
      setMembers((m) => m.filter((x) => x.userId !== p.userId));
    };
    const onBarrage = (p: RoomBarragePayload) => {
      if (p.roomId !== roomId) return;
      setBarrages((b) => [...b, p].slice(-6));
    };
    const onQueue = (p: RoomQueuePayload) => { if (p.roomId === roomId) setQueue(p.queue); };
    const onTurn = (p: TelephoneTurnPayload) => { if (p.roomId === roomId) { setTelTurn(p); setTelResult(null); } };
    const onResult = (p: TelephoneResultPayload) => { if (p.roomId === roomId) { setTelResult(p); setTelTurn(null); } };
    const onQuizQ = (p: QuizQuestionPayload) => { if (p.roomId === roomId) { setQuizQ(p); setQuizResult(null); setAnswered(false); } };
    const onQuizR = (p: QuizResultPayload) => { if (p.roomId === roomId) { setQuizResult(p); setQuizQ(null); } };

    socket.on(ROOM_EVENTS.CAPTION, onCaption);
    socket.on(ROOM_EVENTS.MEMBER_JOINED, onJoined);
    socket.on(ROOM_EVENTS.MEMBER_LEFT, onLeft);
    socket.on(ROOM_EVENTS.BARRAGE, onBarrage);
    socket.on(ROOM_EVENTS.QUEUE_UPDATED, onQueue);
    socket.on(ROOM_EVENTS.TELEPHONE_TURN, onTurn);
    socket.on(ROOM_EVENTS.TELEPHONE_RESULT, onResult);
    socket.on(ROOM_EVENTS.QUIZ_QUESTION, onQuizQ);
    socket.on(ROOM_EVENTS.QUIZ_RESULT, onQuizR);
    return () => {
      socket.off(ROOM_EVENTS.CAPTION, onCaption);
      socket.off(ROOM_EVENTS.MEMBER_JOINED, onJoined);
      socket.off(ROOM_EVENTS.MEMBER_LEFT, onLeft);
      socket.off(ROOM_EVENTS.BARRAGE, onBarrage);
      socket.off(ROOM_EVENTS.QUEUE_UPDATED, onQueue);
      socket.off(ROOM_EVENTS.TELEPHONE_TURN, onTurn);
      socket.off(ROOM_EVENTS.TELEPHONE_RESULT, onResult);
      socket.off(ROOM_EVENTS.QUIZ_QUESTION, onQuizQ);
      socket.off(ROOM_EVENTS.QUIZ_RESULT, onQuizR);
    };
  }, [roomId]);

  async function enter() {
    setBusy(true); setError(null);
    try {
      let id = roomInput.trim();
      if (!id) id = (await api.createRoom()).roomId;
      const res = await api.joinRoom(id, lang);
      setMembers(res.members);
      setRoomId(id);
      // 真实音频（仅 livekit 模式 + 配了 URL；mock 下为 no-op）
      connectRoomAudio(res.token).then((h) => { audioRef.current = h; setAudioOn(!!h); }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '进房失败');
    } finally { setBusy(false); }
  }

  const send = async (t: string) => { const b = t.trim(); if (!b || !roomId) return; setText(''); try { await api.roomUtterance(roomId, b); } catch { /* ignore */ } };
  const barrage = async () => { const b = text.trim(); if (!b || !roomId) return; setText(''); try { await api.roomBarrage(roomId, b); } catch { /* ignore */ } };
  const toggleHand = async () => { if (!roomId) return; try { handUp ? await api.roomLowerHand(roomId) : await api.roomRaiseHand(roomId); } catch { /* ignore */ } };
  const startTel = async () => { if (!roomId) return; const seed = text.trim() || (PHRASES[lang] ?? PHRASES.en)[0]; setText(''); try { await api.telephoneStart(roomId, seed); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const passTel = async () => { if (!roomId || !telTurn) return; const t = passText.trim() || telTurn.heardText; setPassText(''); try { await api.telephonePass(roomId, telTurn.gameId, t); setTelTurn(null); } catch { /* ignore */ } };
  const startQuiz = async () => { if (!roomId) return; try { await api.quizStart(roomId); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const answerQuiz = async (choice: number) => { if (!roomId || !quizQ || answered) return; setAnswered(true); try { await api.quizAnswer(roomId, quizQ.questionId, choice); } catch { /* ignore */ } };
  const leave = async () => { audioRef.current?.disconnect(); audioRef.current = null; if (roomId) { try { await api.leaveRoom(roomId); } catch { /* ignore */ } } router.back(); };

  // ---------- 进房前 ----------
  if (!roomId) {
    return (
      <View style={s.container}>
        <Text style={s.title}>🗣 巴别塔语聊房</Text>
        <Text style={s.sub}>每人说母语，各自看到自己语言的字幕。含弹幕 / 上麦 / 跨语言传话。</Text>
        <Text style={s.label}>我的语言</Text>
        <View style={s.row}>{LANGS.map((l) => <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />)}</View>
        <Text style={s.label}>房间号（留空＝新建房间）</Text>
        <TextInput value={roomInput} onChangeText={setRoomInput} placeholder="粘贴房间号加入，或留空新建" placeholderTextColor={colors.textDim} style={s.input} autoCapitalize="none" />
        {error && <Text style={s.error}>{error}</Text>}
        <Btn label={busy ? '进入中…' : '进入房间'} variant="primary" onPress={enter} style={{ marginTop: 16 }} />
        <Text style={s.hint}>两个浏览器窗口分别选不同语言进同一房间号，即可体验跨语言玩法。</Text>
      </View>
    );
  }

  // ---------- 房内 ----------
  const myPhrases = PHRASES[lang] ?? PHRASES.en;
  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.roomTitle}>房间 {roomId.slice(0, 8)}…</Text>
        <Btn label="离开" variant="ghost" onPress={leave} />
      </View>
      <Text selectable style={s.roomIdLine}>房间号：{roomId}（复制到另一窗口加入）</Text>
      <Text style={s.roomIdLine}>{audioOn ? '🎧 实时语音已接入（LiveKit）' : ENV.transport === 'livekit' ? '🎧 语音未连接（检查 LIVEKIT_URL）' : '💬 打字模式（mock，真实语音见 LIVEKIT-SETUP.md）'}</Text>

      {/* 成员 + 麦序 */}
      <View style={s.row}>
        {members.map((m) => {
          const pos = queue.findIndex((q) => q.userId === m.userId);
          return (
            <View key={m.userId} style={s.member}>
              <Text style={s.memberName}>{m.displayName}{pos >= 0 ? ` ✋${pos + 1}` : ''}</Text>
              <Text style={s.memberLang}>{m.language}</Text>
            </View>
          );
        })}
      </View>

      {/* 弹幕条 */}
      {barrages.length > 0 && (
        <View style={s.barrageBar}>
          {barrages.slice(-4).map((b, i) => (
            <Text key={i} style={s.barrageItem} numberOfLines={1}>💬 {b.fromName}: {b.translatedText}</Text>
          ))}
        </View>
      )}

      {/* 传话游戏卡 */}
      {telTurn && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>🔔 轮到你传话（第 {telTurn.hop} 棒）</Text>
          <Text style={s.gameHeard}>你听到（{telTurn.heardLang}）：{telTurn.heardText}</Text>
          <View style={s.sendRow}>
            <TextInput value={passText} onChangeText={setPassText} placeholder="用你的话复述，传给下一个…" placeholderTextColor={colors.textDim} style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={passTel} />
            <Btn label="传下去" variant="accent" onPress={passTel} />
          </View>
        </View>
      )}
      {telResult && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>📞 传话结果（看走样了多少）</Text>
          {telResult.chain.map((c, i) => (
            <Text key={i} style={s.chainLine}>{i + 1}. {c.displayName}（{c.lang}）：{c.text}</Text>
          ))}
          <Text style={s.gameHeard}>起：{telResult.startText} → 终：{telResult.endText}</Text>
          <Btn label="知道了" variant="ghost" onPress={() => setTelResult(null)} style={{ marginTop: 8 }} />
        </View>
      )}

      {/* PK 抢答 */}
      {quizQ && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>🏆 PK 抢答（第 {quizQ.index + 1}/{quizQ.total} 题）</Text>
          <Text style={s.translated}>{quizQ.prompt}</Text>
          <View style={s.row}>
            {quizQ.options.map((opt, i) => (
              <Chip key={i} label={opt} active={false} onPress={() => answerQuiz(i)} />
            ))}
          </View>
          {answered && <Text style={s.gameHeard}>已抢答，等结果…</Text>}
        </View>
      )}
      {quizResult && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>🏁 PK 结果{quizResult.winner ? ` · 🥇 ${quizResult.winner.displayName}` : ' · 平局'}</Text>
          {quizResult.scores.map((sc) => (
            <Text key={sc.userId} style={s.chainLine}>{sc.displayName}：{sc.score} 分</Text>
          ))}
          <Btn label="知道了" variant="ghost" onPress={() => setQuizResult(null)} style={{ marginTop: 8 }} />
        </View>
      )}

      {/* 字幕流 */}
      <ScrollView ref={scrollRef} style={s.feed} contentContainerStyle={{ padding: 12, gap: 10 }}>
        {captions.length === 0 ? (
          <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 24 }}>还没有字幕。下面发言、发弹幕，或开一局传话游戏。</Text>
        ) : captions.map((c, i) => (
          <View key={i} style={s.bubble}>
            <Text style={s.from}>{c.fromName} · {c.originalLang}→{c.targetLang}</Text>
            <Text style={s.translated}>{c.translatedText}</Text>
            <Text style={s.original}>{c.originalText}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 控制行 */}
      <View style={s.row}>
        <Btn label={handUp ? '✋ 下麦' : '✋ 上麦'} variant={handUp ? 'accent' : 'ghost'} onPress={toggleHand} />
        <Btn label="🎙 开一局传话" variant="ghost" onPress={startTel} />
        <Btn label="🏆 PK 抢答" variant="ghost" onPress={startQuiz} />
      </View>

      {/* 快捷发言 */}
      <View style={s.row}>{myPhrases.slice(0, 3).map((p) => <Chip key={p} label={p.length > 10 ? p.slice(0, 10) + '…' : p} onPress={() => send(p)} />)}</View>
      <View style={s.sendRow}>
        <TextInput value={text} onChangeText={setText} placeholder={`用${lang}说点什么…`} placeholderTextColor={colors.textDim} style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={() => send(text)} />
        <Btn label="弹幕" variant="ghost" onPress={barrage} />
        <Btn label="发送" variant="primary" onPress={() => send(text)} />
      </View>
    </View>
  );
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
  member: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  memberName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  memberLang: { color: colors.textDim, fontSize: 11 },
  barrageBar: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 8, gap: 2 },
  barrageItem: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  gameCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: 12, gap: 6 },
  gameTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  gameHeard: { color: colors.textDim, fontSize: 13 },
  chainLine: { color: colors.text, fontSize: 13 },
  feed: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, marginTop: 4 },
  bubble: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12 },
  from: { color: colors.textDim, fontSize: 11, marginBottom: 4 },
  translated: { color: colors.text, fontSize: 17, fontWeight: '700' },
  original: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
});
