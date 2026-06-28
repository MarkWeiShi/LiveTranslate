import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
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
import { avatarUrl } from '@/game/avatar';
import { GiftPanel } from '@/components/voiceroom/GiftPanel';
import { GiftFly, type GiftFlyItem, BIG_GIFT_COINS } from '@/components/voiceroom/GiftFly';
import { RechargeSheet } from '@/components/voiceroom/RechargeSheet';
import type { GiftDef } from '@/game/gifts';
import type { StarPack } from '@linku/shared';
import { ApiError } from '@/api/client';

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
  const [micMode, setMicMode] = useState<'free' | 'approval'>('free');
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
  const [earnings, setEarnings] = useState(0);
  const [liveSpeakers, setLiveSpeakers] = useState<string[]>([]);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeBusy, setRechargeBusy] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [following, setFollowing] = useState(false);

  const audioRef = useRef<RoomAudioHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const flyId = useRef(0);
  const comboRef = useRef<{ key: string; id: number; combo: number; ts: number } | null>(null);

  // 优先用 LiveKit 真实音量（liveSpeakers），无 LiveKit 时回退"谁发消息谁亮"（speaking 衰减）。
  const isSpeaking = (uid: string | null) => !!uid && (liveSpeakers.includes(uid) || (speaking[uid] ?? 0) > Date.now());
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
    const onGift = (p: RoomGiftPayload) => { if (p.roomId === roomId) { pushGift(p); if (p.toUserId === myId) refreshWallet(); } };
    const onSeats = (p: RoomSeatsPayload) => { if (p.roomId === roomId) { setSeats(p.seats); setAudienceCount(p.audienceCount); setHostId(p.hostId); setMicMode(p.micMode); } };
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
      connectRoomAudio(res.token, { onActiveSpeakers: setLiveSpeakers }).then((h) => { audioRef.current = h; setAudioOn(!!h); }).catch(() => {});
      api.wallet().then((w) => { setBalance(w.diamonds); setEarnings(w.earnings); }).catch(() => {});
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
  const sendGift = async (g: GiftDef) => {
    if (!roomId) return;
    setGiftPanel(false);
    try {
      const res = await api.roomGift(roomId, g.type, giftTarget?.userId ?? null);
      setBalance(res.balance);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_DIAMONDS') setShowRecharge(true);
    }
  };
  const refreshWallet = () => { api.wallet().then((w) => { setBalance(w.diamonds); setEarnings(w.earnings); }).catch(() => {}); };
  const withdraw = async () => { if (earnings <= 0) return; try { const w = await api.walletWithdraw(earnings); setBalance(w.diamonds); setEarnings(w.earnings); } catch { /* ignore */ } };
  const onPickPack = async (pack: StarPack) => {
    if (rechargeBusy) return;
    setRechargeBusy(true);
    try {
      const res = await api.walletRecharge(pack.id);
      const wa = (typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (status: string) => void) => void } } }).Telegram?.WebApp : undefined);
      if (res.mode === 'stars' && res.invoiceLink && wa?.openInvoice) {
        wa.openInvoice(res.invoiceLink, (status: string) => {
          if (status === 'paid') { setShowRecharge(false); setTimeout(refreshWallet, 1200); }
        });
      } else {
        // 非 Telegram / 无发票 → dev 入账
        const w = await api.walletRechargeDev(pack.id);
        setBalance(w.diamonds);
        setShowRecharge(false);
      }
    } catch { /* ignore */ }
    finally { setRechargeBusy(false); }
  };
  const onSeatPress = (seat: SeatDto) => {
    // 房主：点任意非自己麦位 → 管理面板（空位可锁/解锁，有人可送礼/静音/抱下麦/锁）
    if (isHost && !seat.isHost && seat.userId !== myId) { setSeatAction(seat); return; }
    if (!seat.userId) {
      if (seat.index >= 1 && !seat.locked && roomId) api.micApply(roomId, seat.index).catch(() => {});
      return;
    }
    setGiftTarget({ userId: seat.userId, displayName: seat.displayName ?? '' }); setGiftPanel(true);
  };
  const toggleMode = async () => { if (roomId) try { await api.micSetMode(roomId, micMode === 'free' ? 'approval' : 'free'); } catch { /* ignore */ } };
  const lock = async (seatIndex: number, locked: boolean) => { if (roomId) try { await api.micLock(roomId, seatIndex, locked); } catch { /* ignore */ } };
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
  const nameOf = (uid: string) => members.find((m) => m.userId === uid)?.displayName ?? seats.find((x) => x.userId === uid)?.displayName ?? '？';
  const contributors = Object.entries(charm).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <View style={s.room}>
      {/* 房间渐变氛围背景 */}
      <View style={s.bgTop} pointerEvents="none" />
      <View style={s.bgGlow} pointerEvents="none" />

      {/* 顶栏：房主头像 + 房名 + 在线 + 关注 */}
      <View style={s.topBar}>
        <Pressable onPress={leave}><Text style={s.topIcon}>←</Text></Pressable>
        {hostSeat?.userId
          ? <Image source={{ uri: avatarUrl(hostSeat.userId) }} style={s.topAvatar} />
          : <View style={[s.topAvatar, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />}
        <View style={{ flex: 1 }}>
          <Text style={s.roomName} numberOfLines={1}>{hostSeat?.displayName ?? '语聊房'} 的房间</Text>
          <Text style={s.roomMeta}>ID {roomId.slice(0, 6)} · 在线 {members.length} · {audioOn ? '🎧 语音' : ENV.transport === 'livekit' ? '语音未连' : '💬 打字'}</Text>
        </View>
        {isHost ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable onPress={toggleMode} style={s.modeBtn}><Text style={s.modeText}>{micMode === 'free' ? '自由' : '审批'}</Text></Pressable>
            {micMode === 'approval' && (
              <Pressable onPress={() => setShowRequests(true)} style={s.reqBtn}><Text style={s.reqText}>申请{micRequests.length > 0 ? `·${micRequests.length}` : ''}</Text></Pressable>
            )}
          </View>
        ) : (
          <Pressable onPress={() => setFollowing((v) => !v)} style={[s.followBtn, following && s.followingBtn]}>
            <Text style={[s.followText, following && { color: 'rgba(255,255,255,0.6)' }]}>{following ? '已关注' : '+ 关注'}</Text>
          </Pressable>
        )}
      </View>

      {/* 贡献榜 Top3 */}
      {contributors.length > 0 && (
        <View style={s.contribBar}>
          <Text style={s.contribLabel}>🏆 贡献榜</Text>
          {contributors.map(([uid, v], i) => (
            <View key={uid} style={s.contribItem}>
              <Text style={s.contribRank}>{['①', '②', '③'][i]}</Text>
              <Image source={{ uri: avatarUrl(uid) }} style={s.contribAvatar} />
              <Text style={s.contribName} numberOfLines={1}>{nameOf(uid)}</Text>
              <Text style={s.contribVal}>💎{v}</Text>
            </View>
          ))}
        </View>
      )}

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
            locked={seat.locked}
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
          <View key={i} style={s.msgBubble}>
            <Text style={s.msgName}>{c.fromName}</Text>
            <Text style={s.msgText}>{c.translatedText}</Text>
          </View>
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
        <Pressable onPress={() => setShowRecharge(true)} style={s.balanceChip}><Text style={s.balanceText}>💎 {balance}</Text></Pressable>
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

      {/* 房主：麦位管理（空位可锁/解锁；有人可送礼/静音/抱下麦/锁麦位） */}
      {seatAction && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={s.scrim} onPress={() => setSeatAction(null)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{seatAction.userId ? `${seatAction.displayName} · ${seatAction.index} 号麦` : `${seatAction.index} 号麦（${seatAction.locked ? '已锁定' : '空闲'}）`}</Text>
            {seatAction.userId && (
              <>
                <Btn label="🎁 送礼" variant="primary" onPress={() => { setGiftTarget({ userId: seatAction.userId!, displayName: seatAction.displayName ?? '' }); setSeatAction(null); setGiftPanel(true); }} />
                <Btn label={seatAction.muted ? '🔊 取消静音' : '🔇 静音'} variant="ghost" onPress={() => { if (roomId) api.micMute(roomId, seatAction.index, !seatAction.muted).catch(() => {}); setSeatAction(null); }} />
                <Btn label="⬇️ 抱下麦" variant="ghost" onPress={() => { if (roomId) api.micKick(roomId, seatAction.index).catch(() => {}); setSeatAction(null); }} />
              </>
            )}
            <Btn label={seatAction.locked ? '🔓 解锁麦位' : '🔒 锁定麦位'} variant="ghost" onPress={() => { lock(seatAction.index, !seatAction.locked); setSeatAction(null); }} />
            <Btn label="关闭" variant="ghost" onPress={() => setSeatAction(null)} />
          </View>
        </View>
      )}

      {/* 礼物面板 */}
      <GiftPanel visible={giftPanel} balance={balance} targetName={giftTarget?.displayName ?? '全场'} onClose={() => setGiftPanel(false)} onSend={sendGift} />

      {/* 钱包：充值 + 收益提现 */}
      <RechargeSheet visible={showRecharge} balance={balance} earnings={earnings} busy={rechargeBusy} onClose={() => setShowRecharge(false)} onPick={onPickPack} onWithdraw={withdraw} />
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
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, backgroundColor: '#3a1d5c' },
  bgGlow: { position: 'absolute', top: -80, left: '10%', width: '80%', height: 320, borderRadius: 9999, backgroundColor: '#7c3aed', opacity: 0.35, filter: 'blur(80px)' as unknown as undefined },
  topAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.3)' },
  followBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  followText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  contribBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 6 },
  contribLabel: { color: wolf.gold, fontSize: 12, fontWeight: '700' },
  contribItem: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  contribRank: { color: wolf.gold, fontSize: 12 },
  contribAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)' },
  contribName: { color: '#fff', fontSize: 11, maxWidth: 48 },
  contribVal: { color: wolf.gold, fontSize: 10, fontWeight: '700' },
  msgBubble: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', maxWidth: '92%' },
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
  modeBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: wolf.border },
  modeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
  msgName: { color: wolf.gold, fontWeight: '700', fontSize: 11, marginBottom: 1 },
  msgText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 19 },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, flexWrap: 'wrap' },
  gamesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, paddingBottom: 22 },
  barBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: PANEL, alignItems: 'center', justifyContent: 'center' },
  barIcon: { fontSize: 20 },
  balanceChip: { height: 44, borderRadius: 22, backgroundColor: PANEL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  balanceText: { color: wolf.gold, fontWeight: '800', fontSize: 13 },
  fakeInput: { flex: 1, height: 40, borderRadius: 20, backgroundColor: PANEL, justifyContent: 'center', paddingHorizontal: 16 },
  fakeInputText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
