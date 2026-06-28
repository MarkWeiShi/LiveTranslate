import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROOM_EVENTS,
  type RoomBarragePayload,
  type RoomCaptionPayload,
  type RoomMemberDto,
  type RoomMemberJoinedPayload,
  type RoomMemberLeftPayload,
  type RoomGiftPayload,
  type SeatDto,
  type RoomSeatsPayload,
  type RoomMicRequestsPayload,
  type MicRequestEntry,
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
import { colors, radius, wolf } from '@/theme';
import { MicSeat, type SeatMember } from '@/components/voiceroom/MicSeat';
import { GiftPanel } from '@/components/voiceroom/GiftPanel';
import { GiftFly, type GiftFlyItem, BIG_GIFT_COINS } from '@/components/voiceroom/GiftFly';
import type { GiftDef } from '@/game/gifts';

const LANGS = [
  { code: 'zh', label: '中文 🇨🇳' },
  { code: 'es', label: 'Español 🇪🇸' },
  { code: 'en', label: 'English 🇺🇸' },
  { code: 'ar', label: 'العربية 🇦🇪' },
];
const PHRASES: Record<string, string[]> = {
  zh: ['你好，很高兴认识你！', '你今天过得怎么样？', '我喜欢旅行和摄影。'],
  en: ['Hi, nice to meet you!', 'How was your day?', 'I love traveling and photography.'],
  es: ['¡Hola, mucho gusto!', '¿Qué tal tu día?', 'Me encanta viajar.'],
  ar: ['مرحبا، سعيد بلقائك!', 'كيف كان يومك؟', 'أحب السفر.'],
};

export default function BabelRoomScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);

  const [lang, setLang] = useState('zh');
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMemberDto[]>([]);
  const [seats, setSeats] = useState<SeatDto[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const [micRequests, setMicRequests] = useState<MicRequestEntry[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [seatAction, setSeatAction] = useState<SeatDto | null>(null);
  const [captions, setCaptions] = useState<RoomCaptionPayload[]>([]);
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
  // BIGO 式新增
  const [speaking, setSpeaking] = useState<Record<string, number>>({});
  const [charm, setCharm] = useState<Record<string, number>>({});
  const [flyItems, setFlyItems] = useState<GiftFlyItem[]>([]);
  const [bigGift, setBigGift] = useState<GiftFlyItem | null>(null);
  const [giftPanel, setGiftPanel] = useState(false);
  const [giftTarget, setGiftTarget] = useState<{ userId: string; displayName: string } | null>(null);
  const [balance, setBalance] = useState(0);
  const [showGames, setShowGames] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const audioRef = useRef<RoomAudioHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const flyId = useRef(0);
  const comboRef = useRef<{ key: string; id: number; combo: number; ts: number } | null>(null);

  const isSpeaking = (uid: string | null) => !!uid && (speaking[uid] ?? 0) > Date.now();
  const isHost = !!myId && hostId === myId;
  const mySeat = seats.find((s) => s.userId === myId) ?? null;
  const onMic = !!mySeat;

  useEffect(() => { if (token && !getSocket()) connectWs(token); }, [token]);
  useEffect(() => () => { audioRef.current?.disconnect(); audioRef.current = null; }, []);

  function markSpeaking(uid: string) {
    setSpeaking((s) => ({ ...s, [uid]: Date.now() + 2500 }));
    setTimeout(() => setSpeaking((s) => { if ((s[uid] ?? 0) <= Date.now()) { const n = { ...s }; delete n[uid]; return n; } return s; }), 2600);
  }

  function pushGift(p: RoomGiftPayload) {
    const key = `${p.fromUserId}:${p.giftType}`;
    if (comboRef.current && comboRef.current.key === key && p.ts - comboRef.current.ts < 3000) {
      comboRef.current.combo += 1; comboRef.current.ts = p.ts;
      const id = comboRef.current.id; const combo = comboRef.current.combo;
      setFlyItems((prev) => [...prev.filter((x) => x.id !== id), { id, fromName: p.fromName, giftType: p.giftType, coins: p.coins, combo }].slice(-6));
    } else {
      const id = ++flyId.current;
      comboRef.current = { key, id, combo: 1, ts: p.ts };
      setFlyItems((prev) => [...prev, { id, fromName: p.fromName, giftType: p.giftType, coins: p.coins, combo: 1 }].slice(-6));
      setTimeout(() => setFlyItems((prev) => prev.filter((x) => x.id !== id)), 4000);
    }
    if (p.coins >= BIG_GIFT_COINS) {
      const bid = ++flyId.current;
      setBigGift({ id: bid, fromName: p.fromName, giftType: p.giftType, coins: p.coins, combo: 1 });
      setTimeout(() => setBigGift((cur) => (cur && cur.id === bid ? null : cur)), 2600);
    }
    if (p.toUserId) setCharm((c) => ({ ...c, [p.toUserId!]: (c[p.toUserId!] ?? 0) + p.coins }));
  }

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;
    const onCaption = (p: RoomCaptionPayload) => {
      if (p.roomId !== roomId) return;
      setCaptions((c) => [...c, p].slice(-100));
      markSpeaking(p.fromUserId);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };
    const onJoined = (p: RoomMemberJoinedPayload) => { if (p.roomId === roomId) setMembers((m) => (m.some((x) => x.userId === p.member.userId) ? m : [...m, p.member])); };
    const onLeft = (p: RoomMemberLeftPayload) => { if (p.roomId === roomId) setMembers((m) => m.filter((x) => x.userId !== p.userId)); };
    const onBarrage = (p: RoomBarragePayload) => {
      if (p.roomId !== roomId) return;
      setCaptions((c) => [...c, p].slice(-100));
      markSpeaking(p.fromUserId);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    };
    const onTurn = (p: TelephoneTurnPayload) => { if (p.roomId === roomId) { setTelTurn(p); setTelResult(null); } };
    const onResult = (p: TelephoneResultPayload) => { if (p.roomId === roomId) { setTelResult(p); setTelTurn(null); } };
    const onQuizQ = (p: QuizQuestionPayload) => { if (p.roomId === roomId) { setQuizQ(p); setQuizResult(null); setAnswered(false); } };
    const onQuizR = (p: QuizResultPayload) => { if (p.roomId === roomId) { setQuizResult(p); setQuizQ(null); } };
    const onGift = (p: RoomGiftPayload) => { if (p.roomId === roomId) pushGift(p); };
    const onSeats = (p: RoomSeatsPayload) => { if (p.roomId === roomId) { setSeats(p.seats); setAudienceCount(p.audienceCount); setHostId(p.hostId); } };
    const onMicReqs = (p: RoomMicRequestsPayload) => { if (p.roomId === roomId) setMicRequests(p.requests); };

    socket.on(ROOM_EVENTS.CAPTION, onCaption);
    socket.on(ROOM_EVENTS.MEMBER_JOINED, onJoined);
    socket.on(ROOM_EVENTS.MEMBER_LEFT, onLeft);
    socket.on(ROOM_EVENTS.BARRAGE, onBarrage);
    socket.on(ROOM_EVENTS.TELEPHONE_TURN, onTurn);
    socket.on(ROOM_EVENTS.TELEPHONE_RESULT, onResult);
    socket.on(ROOM_EVENTS.QUIZ_QUESTION, onQuizQ);
    socket.on(ROOM_EVENTS.QUIZ_RESULT, onQuizR);
    socket.on(ROOM_EVENTS.GIFT, onGift);
    socket.on(ROOM_EVENTS.SEATS, onSeats);
    socket.on(ROOM_EVENTS.MIC_REQUESTS, onMicReqs);
    return () => {
      socket.off(ROOM_EVENTS.CAPTION, onCaption);
      socket.off(ROOM_EVENTS.MEMBER_JOINED, onJoined);
      socket.off(ROOM_EVENTS.MEMBER_LEFT, onLeft);
      socket.off(ROOM_EVENTS.BARRAGE, onBarrage);
      socket.off(ROOM_EVENTS.TELEPHONE_TURN, onTurn);
      socket.off(ROOM_EVENTS.TELEPHONE_RESULT, onResult);
      socket.off(ROOM_EVENTS.QUIZ_QUESTION, onQuizQ);
      socket.off(ROOM_EVENTS.QUIZ_RESULT, onQuizR);
      socket.off(ROOM_EVENTS.GIFT, onGift);
      socket.off(ROOM_EVENTS.SEATS, onSeats);
      socket.off(ROOM_EVENTS.MIC_REQUESTS, onMicReqs);
    };
  }, [roomId]);

  async function enter() {
    setBusy(true); setError(null);
    try {
      let id = roomInput.trim();
      if (!id) id = (await api.createRoom()).roomId;
      const res = await api.joinRoom(id, lang);
      setMembers(res.members);
      setSeats(res.seats);
      setHostId(res.hostId);
      setRoomId(id);
      connectRoomAudio(res.token).then((h) => { audioRef.current = h; setAudioOn(!!h); }).catch(() => {});
      api.wallet().then((w) => setBalance(w.diamonds)).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : '进房失败'); }
    finally { setBusy(false); }
  }

  const send = async (t: string) => { const b = t.trim(); if (!b || !roomId) return; setText(''); try { await api.roomUtterance(roomId, b); } catch { /* ignore */ } };
  const barrage = async () => { const b = text.trim(); if (!b || !roomId) return; setText(''); try { await api.roomBarrage(roomId, b); } catch { /* ignore */ } };
  const toggleMic = async () => { if (!roomId) return; try { onMic ? await api.micLeave(roomId) : await api.micApply(roomId); } catch { /* ignore */ } };
  const approve = async (uid: string, seatIndex: number | null) => { if (roomId) try { await api.micApprove(roomId, uid, seatIndex); } catch { /* ignore */ } };
  const reject = async (uid: string) => { if (roomId) try { await api.micReject(roomId, uid); } catch { /* ignore */ } };
  const startTel = async () => { if (!roomId) return; const seed = (PHRASES[lang] ?? PHRASES.en)[0]; try { await api.telephoneStart(roomId, seed); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const passTel = async () => { if (!roomId || !telTurn) return; const t = passText.trim() || telTurn.heardText; setPassText(''); try { await api.telephonePass(roomId, telTurn.gameId, t); setTelTurn(null); } catch { /* ignore */ } };
  const startQuiz = async () => { if (!roomId) return; try { await api.quizStart(roomId); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const answerQuiz = async (choice: number) => { if (!roomId || !quizQ || answered) return; setAnswered(true); try { await api.quizAnswer(roomId, quizQ.questionId, choice); } catch { /* ignore */ } };
  const sendGift = async (g: GiftDef) => { if (!roomId) return; setGiftPanel(false); try { await api.roomGift(roomId, g.type, g.coins, giftTarget?.userId ?? null); } catch { /* ignore */ } };
  const onSeatPress = (seat: SeatDto) => {
    if (!seat.userId) { if (seat.index >= 1 && roomId) api.micApply(roomId, seat.index).catch(() => {}); return; }
    if (isHost && !seat.isHost && seat.userId !== myId) { setSeatAction(seat); return; }
    setGiftTarget({ userId: seat.userId, displayName: seat.displayName ?? '' }); setGiftPanel(true);
  };
  const openGift = () => { const h = seats[0]; setGiftTarget(h?.userId ? { userId: h.userId, displayName: h.displayName ?? '' } : null); setGiftPanel(true); };
  const leave = async () => { audioRef.current?.disconnect(); audioRef.current = null; if (roomId) { try { await api.leaveRoom(roomId); } catch { /* ignore */ } } router.back(); };

  // ---------- 进房前 ----------
  if (!roomId) {
    return (
      <View style={s.lobby}>
        <Text style={s.title}>🎤 语聊房</Text>
        <Text style={s.sub}>BIGO 式麦位语聊房：上麦、送礼、跨语言字幕。各人说母语，看到自己语言的字幕。</Text>
        <Text style={s.label}>我的语言</Text>
        <View style={s.row}>{LANGS.map((l) => <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />)}</View>
        <Text style={s.label}>房间号（留空＝新建房间）</Text>
        <TextInput value={roomInput} onChangeText={setRoomInput} placeholder="粘贴房间号加入，或留空新建" placeholderTextColor="rgba(255,255,255,0.4)" style={s.input} autoCapitalize="none" />
        {error && <Text style={s.error}>{error}</Text>}
        <Btn label={busy ? '进入中…' : '进入房间'} variant="primary" onPress={enter} style={{ marginTop: 16 }} />
        <Text style={s.hint}>两个窗口选不同语言进同一房间号，即可体验跨语言麦位语聊 + 送礼。</Text>
      </View>
    );
  }

  // ---------- 房内（BIGO 布局）----------
  const hostSeat = seats[0] ?? null;
  const gridSeats = seats.slice(1);
  const seatMember = (seat: SeatDto | null): SeatMember | null => (seat?.userId ? { userId: seat.userId, displayName: seat.displayName ?? '' } : null);

  return (
    <View style={s.room}>
      {/* 顶栏 */}
      <View style={s.topBar}>
        <Pressable onPress={leave}><Text style={s.topIcon}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.roomName} numberOfLines={1}>房间 {roomId.slice(0, 6)}</Text>
          <Text style={s.roomMeta}>在线 {members.length} · 听众 {audienceCount} · {audioOn ? '🎧' : ENV.transport === 'livekit' ? '语音未连' : '💬'}</Text>
        </View>
        {isHost && (
          <Pressable onPress={() => setShowRequests(true)} style={s.reqBtn}>
            <Text style={s.reqText}>上麦{micRequests.length > 0 ? ` ·${micRequests.length}` : ''}</Text>
          </Pressable>
        )}
      </View>

      {/* 麦位区 */}
      <View style={s.hostRow}>
        {hostSeat && (
          <MicSeat seatNo={0} member={seatMember(hostSeat)} isHost isMe={hostSeat.userId === myId} muted={hostSeat.muted} speaking={isSpeaking(hostSeat.userId)} charm={hostSeat.userId ? charm[hostSeat.userId] ?? 0 : 0} onPress={() => onSeatPress(hostSeat)} />
        )}
      </View>
      <View style={s.seatGrid}>
        {gridSeats.map((seat) => (
          <MicSeat
            key={seat.index}
            seatNo={seat.index}
            member={seatMember(seat)}
            isMe={seat.userId === myId}
            muted={seat.muted}
            speaking={isSpeaking(seat.userId)}
            charm={seat.userId ? charm[seat.userId] ?? 0 : 0}
            onPress={() => onSeatPress(seat)}
          />
        ))}
      </View>

      {/* 游戏卡（保留传话/PK） */}
      {telTurn && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>🔔 轮到你传话（第 {telTurn.hop} 棒）：{telTurn.heardText}</Text>
          <View style={s.sendRow}>
            <TextInput value={passText} onChangeText={setPassText} placeholder="复述传下去…" placeholderTextColor="rgba(255,255,255,0.4)" style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={passTel} />
            <Btn label="传" variant="accent" onPress={passTel} />
          </View>
        </View>
      )}
      {telResult && (<View style={s.gameCard}><Text style={s.gameTitle}>📞 传话：{telResult.startText} → {telResult.endText}</Text><Btn label="知道了" variant="ghost" onPress={() => setTelResult(null)} /></View>)}
      {quizQ && (
        <View style={s.gameCard}>
          <Text style={s.gameTitle}>🏆 抢答（{quizQ.index + 1}/{quizQ.total}）{quizQ.prompt}</Text>
          <View style={s.row}>{quizQ.options.map((opt, i) => <Chip key={i} label={opt} onPress={() => answerQuiz(i)} />)}</View>
          {answered && <Text style={s.dim}>已抢答…</Text>}
        </View>
      )}
      {quizResult && (<View style={s.gameCard}><Text style={s.gameTitle}>🏁 {quizResult.winner ? `🥇 ${quizResult.winner.displayName}` : '平局'}</Text><Btn label="知道了" variant="ghost" onPress={() => setQuizResult(null)} /></View>)}

      {/* 公屏消息 */}
      <ScrollView ref={scrollRef} style={s.feed} contentContainerStyle={{ padding: 10, gap: 6 }}>
        {captions.length === 0 ? (
          <Text style={s.dimCenter}>欢迎来到语聊房 · 发言、送礼、开游戏</Text>
        ) : captions.map((c, i) => (
          <Text key={i} style={s.msg}>
            <Text style={s.msgName}>{c.fromName}：</Text>
            <Text style={s.msgText}>{c.translatedText}</Text>
          </Text>
        ))}
      </ScrollView>

      {/* 礼物飘屏 */}
      <GiftFly items={flyItems} big={bigGift} />

      {/* 输入条（可展开） */}
      {showInput && (
        <View style={s.inputRow}>
          {(PHRASES[lang] ?? PHRASES.en).slice(0, 2).map((p) => <Chip key={p} label={p.length > 8 ? p.slice(0, 8) + '…' : p} onPress={() => send(p)} />)}
          <TextInput value={text} onChangeText={setText} placeholder={`用${lang}说点什么…`} placeholderTextColor="rgba(255,255,255,0.4)" style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={() => send(text)} autoFocus />
          <Btn label="弹幕" variant="ghost" onPress={barrage} />
          <Btn label="发送" variant="primary" onPress={() => send(text)} />
        </View>
      )}

      {/* 游戏行（可展开） */}
      {showGames && (
        <View style={s.gamesRow}>
          <Btn label="🎙 开一局传话" variant="ghost" onPress={startTel} />
          <Btn label="🏆 PK 抢答" variant="ghost" onPress={startQuiz} />
        </View>
      )}

      {/* 底部操作条 */}
      <View style={s.bottomBar}>
        <BarBtn label={onMic ? '🎙' : '🙋'} active={onMic} onPress={toggleMic} />
        <Pressable style={s.fakeInput} onPress={() => setShowInput((v) => !v)}><Text style={s.fakeInputText}>{onMic ? '在麦上 · 点击下麦或说话' : '说点什么…'}</Text></Pressable>
        <BarBtn label="🎮" active={showGames} onPress={() => setShowGames((v) => !v)} />
        <BarBtn label="🎁" onPress={openGift} accent />
      </View>

      {/* 房主：上麦审批面板 */}
      {showRequests && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={s.scrim} onPress={() => setShowRequests(false)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>上麦申请（{micRequests.length}）</Text>
            {micRequests.length === 0 ? <Text style={s.dim}>暂无申请</Text> : micRequests.map((r) => (
              <View key={r.userId} style={s.reqRow}>
                <Text style={s.reqName} numberOfLines={1}>{r.displayName}{r.seatIndex ? ` · 想坐 ${r.seatIndex} 号` : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn label="同意" variant="primary" onPress={() => approve(r.userId, r.seatIndex)} />
                  <Btn label="拒绝" variant="ghost" onPress={() => reject(r.userId)} />
                </View>
              </View>
            ))}
            <Btn label="关闭" variant="ghost" onPress={() => setShowRequests(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      )}

      {/* 房主：麦位管理 */}
      {seatAction && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={s.scrim} onPress={() => setSeatAction(null)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{seatAction.displayName} · {seatAction.index} 号麦</Text>
            <Btn label="🎁 送礼" variant="primary" onPress={() => { setGiftTarget({ userId: seatAction.userId!, displayName: seatAction.displayName ?? '' }); setSeatAction(null); setGiftPanel(true); }} />
            <Btn label={seatAction.muted ? '🔊 取消静音' : '🔇 静音'} variant="ghost" onPress={() => { if (roomId) api.micMute(roomId, seatAction.index, !seatAction.muted).catch(() => {}); setSeatAction(null); }} />
            <Btn label="⬇️ 抱下麦" variant="ghost" onPress={() => { if (roomId) api.micKick(roomId, seatAction.index).catch(() => {}); setSeatAction(null); }} />
            <Btn label="关闭" variant="ghost" onPress={() => setSeatAction(null)} />
          </View>
        </View>
      )}

      {/* 礼物面板 */}
      <GiftPanel visible={giftPanel} balance={balance} targetName={giftTarget?.displayName ?? '全场'} onClose={() => setGiftPanel(false)} onSend={sendGift} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Text onPress={onPress} style={[s.chip, active && { backgroundColor: wolf.gold, borderColor: wolf.gold, color: '#1a1614' }]}>{label}</Text>;
}
function BarBtn({ label, active, accent, onPress }: { label: string; active?: boolean; accent?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.barBtn, active && { backgroundColor: 'rgba(197,160,89,0.25)' }, accent && { backgroundColor: colors.accent }]}><Text style={s.barIcon}>{label}</Text></Pressable>;
}

const PANEL = 'rgba(255,255,255,0.06)';
const s = StyleSheet.create({
  lobby: { flex: 1, backgroundColor: '#14101a', padding: 20, paddingTop: 56, gap: 8 },
  room: { flex: 1, backgroundColor: '#14101a' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 8 },
  sub: { color: 'rgba(255,255,255,0.7)', marginBottom: 8, lineHeight: 20 },
  label: { color: wolf.gold, fontSize: 13, marginTop: 8, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { color: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: wolf.border, backgroundColor: PANEL, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, overflow: 'hidden', fontWeight: '700', fontSize: 13 },
  input: { color: '#fff', backgroundColor: PANEL, borderWidth: 1, borderColor: wolf.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  error: { color: wolf.bloodLight, marginTop: 6 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 16, lineHeight: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 44, paddingBottom: 8 },
  topIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  roomName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  roomMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  reqBtn: { backgroundColor: wolf.gold, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  reqText: { color: '#1a1614', fontWeight: '800', fontSize: 12 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#17131a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10, borderTopWidth: 1, borderColor: wolf.border },
  sheetTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  reqName: { color: '#fff', fontSize: 14, flex: 1 },
  hostRow: { alignItems: 'center', marginTop: 4 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 8, paddingHorizontal: 8 },
  gameCard: { backgroundColor: PANEL, borderWidth: 1, borderColor: wolf.gold, borderRadius: radius.md, padding: 10, gap: 6, marginHorizontal: 12, marginTop: 6 },
  gameTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dim: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  dimCenter: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 16 },
  feed: { flex: 1, marginHorizontal: 12, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.md },
  msg: { fontSize: 13, lineHeight: 19 },
  msgName: { color: wolf.gold, fontWeight: '700' },
  msgText: { color: 'rgba(255,255,255,0.9)' },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, flexWrap: 'wrap' },
  gamesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, paddingBottom: 22 },
  barBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: PANEL, alignItems: 'center', justifyContent: 'center' },
  barIcon: { fontSize: 20 },
  fakeInput: { flex: 1, height: 40, borderRadius: 20, backgroundColor: PANEL, justifyContent: 'center', paddingHorizontal: 16 },
  fakeInputText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
