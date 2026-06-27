import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { colors, radius, wolf } from '@/theme';
import { WolfBackground } from '@/components/werewolf/WolfBackground';
import { LipSyncAvatar } from '@/components/werewolf/LipSyncAvatar';
import { RoleRevealCard } from '@/components/werewolf/RoleRevealCard';
import { NightFx, type NightFxState, type NightFxType } from '@/components/werewolf/NightFx';
import { TypewriterText } from '@/components/werewolf/TypewriterText';

const LANGS = [
  { code: 'zh', label: '中文 🇨🇳' },
  { code: 'en', label: 'English 🇺🇸' },
  { code: 'es', label: 'Español 🇪🇸' },
  { code: 'ar', label: 'العربية 🇦🇪' },
];
const PHASE_LABEL: Record<string, string> = {
  lobby: '⏳ 等待开始', night: '🌙 夜晚', dawn: '🌅 天亮', speak: '🗣 发言', vote: '🗳 投票', over: '🏁 结束',
};

export function WerewolfGame() {
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);

  const [lang, setLang] = useState('zh');
  const [boardKey, setBoardKey] = useState('newbie6');
  const [gameInput, setGameInput] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);

  const [state, setState] = useState<WolfStatePayload | null>(null);
  const [role, setRole] = useState<WolfRolePayload | null>(null);
  const [revealSeen, setRevealSeen] = useState(false);
  const [prompt, setPrompt] = useState<WolfPrivatePayload | null>(null);
  const [hostLines, setHostLines] = useState<WolfHostPayload[]>([]);
  const [speeches, setSpeeches] = useState<WolfSpeechPayload[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [over, setOver] = useState<WolfGameOverPayload | null>(null);

  const [speakText, setSpeakText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fx, setFx] = useState<NightFxState | null>(null);
  const fxId = useRef(0);
  const audioRef = useRef<RoomAudioHandle | null>(null);
  const feedRef = useRef<ScrollView>(null);

  function triggerFx(type: NightFxType) {
    fxId.current += 1;
    setFx({ type, id: fxId.current });
    setTimeout(() => setFx((cur) => (cur && cur.id === fxId.current ? null : cur)), 1800);
  }

  const mySeat = state?.seats.find((s) => s.userId === myId) ?? null;
  const isHost = !!state && !!myId && state.hostUserId === myId;
  const myTurn = !!state && state.phase === 'speak' && !!mySeat && state.currentSpeakerSeat === mySeat.seatNo && mySeat.alive;
  const canVote = !!state && state.phase === 'vote' && !!mySeat && mySeat.alive;
  const isNight = state?.phase === 'night' || state?.phase === 'dawn';

  useEffect(() => { if (token && !getSocket()) connectWs(token); }, [token]);
  useEffect(() => () => { audioRef.current?.disconnect(); audioRef.current = null; }, []);

  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();
    if (!socket) return;
    const mine = (id: string) => id === gameId;
    const onState = (p: WolfStatePayload) => { if (mine(p.gameId)) setState(p); };
    const onRole = (p: WolfRolePayload) => { if (mine(p.gameId)) { setRole(p); setRevealSeen(false); } };
    const onPrivate = (p: WolfPrivatePayload) => {
      if (!mine(p.gameId)) return;
      if (p.kind === 'night_action' || p.kind === 'hunter_shot') setPrompt(p);
      else setNotices((n) => [...n, p.text].slice(-8));
    };
    const onHost = (p: WolfHostPayload) => { if (mine(p.gameId)) { setHostLines((h) => [...h, p].slice(-60)); scrollFeed(); } };
    const onSpeech = (p: WolfSpeechPayload) => { if (mine(p.gameId)) { setSpeeches((s) => [...s, p].slice(-80)); scrollFeed(); } };
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

  useEffect(() => {
    if (state && state.phase !== 'night' && prompt?.action !== 'HUNTER_SHOT') setPrompt(null);
  }, [state?.phase]);

  function scrollFeed() { requestAnimationFrame(() => feedRef.current?.scrollToEnd({ animated: true })); }

  async function enter() {
    setBusy(true); setError(null);
    try {
      let id = gameInput.trim();
      let mediaToken: string;
      if (!id) { const res = await api.wolfCreate(boardKey, lang); id = res.gameId; mediaToken = res.token; }
      else { const res = await api.wolfJoin(id, lang); mediaToken = res.token; }
      setGameId(id);
      connectRoomAudio(mediaToken).then((h) => { audioRef.current = h; }).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : '进入失败'); }
    finally { setBusy(false); }
  }

  const start = async () => { if (gameId) try { await api.wolfStart(gameId); } catch (e) { setError(e instanceof Error ? e.message : ''); } };
  const sendSpeak = async () => { const t = speakText.trim(); if (!t || !gameId) return; setSpeakText(''); try { await api.wolfSpeak(gameId, t); } catch { /* ignore */ } };
  const pass = async () => { if (gameId) try { await api.wolfPass(gameId); } catch { /* ignore */ } };
  const castVote = async (seatNo: number | null) => { if (gameId) try { await api.wolfVote(gameId, seatNo); } catch { /* ignore */ } };
  const act = async (body: { action: WolfPrivatePayload['action']; targetSeat?: number; save?: boolean; poisonSeat?: number }) => {
    if (!gameId || !body.action) return;
    // 本地播放夜间技能特效
    const fxMap: Record<string, NightFxType> = { WOLF_KILL: 'wolf', SEER_CHECK: 'seer', HUNTER_SHOT: 'hunter' };
    if (body.action === 'WITCH') { if (body.save) triggerFx('heal'); else if (body.poisonSeat !== undefined) triggerFx('poison'); }
    else if (fxMap[body.action]) triggerFx(fxMap[body.action]);
    try { await api.wolfNightAction(gameId, { action: body.action, targetSeat: body.targetSeat, save: body.save, poisonSeat: body.poisonSeat }); setPrompt(null); } catch { /* ignore */ }
  };
  const leave = async () => {
    audioRef.current?.disconnect(); audioRef.current = null;
    if (gameId) { try { await api.wolfLeave(gameId); } catch { /* ignore */ } }
    setGameId(null); setState(null); setRole(null); setHostLines([]); setSpeeches([]); setNotices([]); setOver(null); setPrompt(null);
  };

  const seedOf = (seatNo: number, userId: string | null) => userId ?? `${gameId}-seat-${seatNo}`;

  // ---------- 进入前 ----------
  if (!gameId) {
    return (
      <View style={s.root}>
        <WolfBackground isNight />
        <ScrollView contentContainerStyle={s.lobby}>
          <Text style={s.bigTitle}>🐺 跨语言狼人杀</Text>
          <Text style={s.sub}>各说母语、同局博弈。AI 当上帝（多语言旁白）+ 人数不足自动补 AI 玩家。</Text>
          <Text style={s.label}>我的语言</Text>
          <View style={s.row}>{LANGS.map((l) => <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />)}</View>
          <Text style={s.label}>板子</Text>
          <View style={s.row}>{Object.values(WEREWOLF_BOARDS).map((b) => <Chip key={b.key} label={b.name} active={boardKey === b.key} onPress={() => setBoardKey(b.key)} />)}</View>
          <Text style={s.label}>对局号（留空＝新建）</Text>
          <TextInput value={gameInput} onChangeText={setGameInput} placeholder="粘贴对局号加入，或留空新建" placeholderTextColor="rgba(255,255,255,0.4)" style={s.input} autoCapitalize="none" />
          {error && <Text style={s.error}>{error}</Text>}
          <Btn label={busy ? '进入中…' : '进入对局'} variant="primary" onPress={enter} style={{ marginTop: 16 }} />
          <Text style={s.hint}>单人也可玩：新建后直接「开始」，空位由 AI 玩家补满；你会看到 AI 用各自语言发言、被翻成你的母语，头像同步口型。</Text>
        </ScrollView>
      </View>
    );
  }

  // ---------- 对局内 ----------
  const board = state ? WEREWOLF_BOARDS[state.boardKey] : null;
  const aliveSeats = state?.seats.filter((x) => x.alive) ?? [];
  return (
    <View style={s.root}>
      <WolfBackground isNight={!!isNight} />
      <NightFx fx={fx} />

      <View style={s.headerRow}>
        <Text style={s.phase}>{state ? PHASE_LABEL[state.phase] : '…'}{state && state.day > 0 ? ` · 第${state.day}天` : ''}</Text>
        <Btn label="离开" variant="ghost" onPress={leave} />
      </View>
      <Text selectable style={s.idLine}>对局号 {gameId.slice(0, 8)}…{state?.containsAI ? ' · 含 AI 玩家' : ''}</Text>

      {/* 座位网格（lip-sync 头像 + 发言高亮 + 出局去色） */}
      <View style={s.seatGrid}>
        {state?.seats.map((m) => {
          const speaking = state.phase === 'speak' && state.currentSpeakerSeat === m.seatNo && m.alive;
          const ring = speaking ? wolf.gold : null;
          return (
            <View key={m.seatNo} style={s.seat}>
              <LipSyncAvatar seed={seedOf(m.seatNo, m.userId)} size={52} talking={speaking} dead={!m.alive} ring={ring} />
              <Text style={s.seatName} numberOfLines={1}>{m.seatNo}号{m.userId === myId ? '·你' : ''}</Text>
              <Text style={s.seatState}>{m.alive ? (speaking ? '🎙' : '在场') : '💀'}</Text>
            </View>
          );
        })}
      </View>

      {/* 大厅开始 */}
      {state?.phase === 'lobby' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>等待开始（{state.seats.length}/{board?.size} 人）</Text>
          {isHost ? <Btn label="开始对局（空位补 AI）" variant="primary" onPress={start} /> : <Text style={s.dim}>等房主开始…</Text>}
        </View>
      )}

      {/* 私密行动 */}
      {prompt && (
        <View style={[s.card, { borderColor: wolf.gold }]}>
          <Text style={s.cardTitle}>🔒 {prompt.text}</Text>
          {prompt.action === 'WITCH' ? (
            <View style={{ gap: 6 }}>
              {prompt.canSave && <Btn label="💊 用解药救人" variant="accent" onPress={() => act({ action: 'WITCH', save: true })} />}
              {prompt.canPoison && (<>
                <Text style={s.dim}>或选择下毒目标：</Text>
                <View style={s.row}>{prompt.targets?.map((t) => <Chip key={t.seatNo} label={`☠️ ${t.seatNo}号`} onPress={() => act({ action: 'WITCH', poisonSeat: t.seatNo })} />)}</View>
              </>)}
              <Btn label="跳过（不用药）" variant="ghost" onPress={() => act({ action: 'WITCH' })} />
            </View>
          ) : (
            <View style={s.row}>{prompt.targets?.map((t) => <Chip key={t.seatNo} label={`${t.seatNo}号 ${t.displayName}`} onPress={() => act({ action: prompt.action, targetSeat: t.seatNo })} />)}</View>
          )}
        </View>
      )}

      {/* 投票 */}
      {canVote && (
        <View style={[s.card, { borderColor: wolf.gold }]}>
          <Text style={s.cardTitle}>🗳 投票放逐谁？</Text>
          <View style={s.row}>
            {aliveSeats.filter((x) => x.userId !== myId).map((t) => {
              const tally = state?.voteTally?.find((v) => v.seatNo === t.seatNo)?.votes ?? 0;
              return <Chip key={t.seatNo} label={`${t.seatNo}号${tally ? ` (${tally})` : ''}`} onPress={() => castVote(t.seatNo)} />;
            })}
            <Chip label="弃票" onPress={() => castVote(null)} />
          </View>
        </View>
      )}

      {/* 个人通知 */}
      {notices.length > 0 && (
        <View style={s.noticeBar}>{notices.slice(-3).map((n, i) => <Text key={i} style={s.notice}>🔔 {n}</Text>)}</View>
      )}

      {/* 旁白 + 跨语言发言 */}
      <ScrollView ref={feedRef} style={s.feed} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {hostLines.length === 0 && speeches.length === 0 && (
          <Text style={s.dimCenter}>对局开始后，这里显示主持旁白与跨语言发言字幕。</Text>
        )}
        {interleave(hostLines, speeches).map((item) =>
          isHostLine(item) ? (
            <Text key={`h-${item.ts}`} style={s.hostLine}>🎙 {item.text}</Text>
          ) : (
            <View key={`s-${item.ts}-${item.fromSeat}`} style={s.bubble}>
              <Text style={s.from}>{item.fromSeat}号 {item.fromName} · {item.originalLang}→{item.targetLang}</Text>
              <TypewriterText text={item.translatedText} style={s.translated} />
              {item.originalText !== item.translatedText && <Text style={s.original}>{item.originalText}</Text>}
            </View>
          ),
        )}
      </ScrollView>

      {/* 发言输入 */}
      {myTurn && (
        <View style={s.sendRow}>
          <TextInput value={speakText} onChangeText={setSpeakText} placeholder={`轮到你发言（${lang}）…`} placeholderTextColor="rgba(255,255,255,0.4)" style={[s.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={sendSpeak} />
          <Btn label="发言" variant="primary" onPress={sendSpeak} />
          <Btn label="过麦" variant="ghost" onPress={pass} />
        </View>
      )}

      {/* 角色翻牌 */}
      {role && state?.started && !revealSeen && state.phase !== 'over' && (
        <RoleRevealCard role={role} onContinue={() => setRevealSeen(true)} />
      )}

      {/* 结算 */}
      {over && (
        <View style={[s.card, s.overCard, { borderColor: over.winner === 'WOLF' ? wolf.blood : wolf.gold }]}>
          <Text style={s.cardTitle}>🏁 {over.winner === 'WOLF' ? '狼人胜利' : '好人胜利'}</Text>
          {over.reveal.map((r) => (
            <Text key={r.seatNo} style={s.revealLine}>{r.seatNo}号 {r.displayName} — {r.role}{r.isAI ? ' 🤖AI' : ''}{r.alive ? '' : ' 💀'}</Text>
          ))}
          <Btn label="再来一局" variant="primary" onPress={leave} style={{ marginTop: 8 }} />
        </View>
      )}
    </View>
  );
}

function interleave(host: WolfHostPayload[], speech: WolfSpeechPayload[]): (WolfHostPayload | WolfSpeechPayload)[] {
  return [...host, ...speech].sort((a, b) => a.ts - b.ts).slice(-80);
}
function isHostLine(item: WolfHostPayload | WolfSpeechPayload): item is WolfHostPayload {
  return !('fromSeat' in item);
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Text onPress={onPress} style={[s.chip, active && { backgroundColor: wolf.gold, borderColor: wolf.gold, color: '#1a1614' }]}>{label}</Text>;
}

const PANEL = 'rgba(20,16,14,0.78)';
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: wolf.dark },
  lobby: { padding: 20, paddingTop: 48, gap: 8 },
  bigTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 8 },
  sub: { color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  label: { color: wolf.gold, fontSize: 13, marginTop: 8, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { color: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: wolf.border, backgroundColor: PANEL, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, overflow: 'hidden', fontWeight: '700', fontSize: 13 },
  input: { color: '#fff', backgroundColor: PANEL, borderWidth: 1, borderColor: wolf.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  error: { color: wolf.bloodLight, marginTop: 6 },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 16, lineHeight: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 44 },
  phase: { color: '#fff', fontSize: 18, fontWeight: '900' },
  idLine: { color: 'rgba(255,255,255,0.5)', fontSize: 12, paddingHorizontal: 16, marginBottom: 4 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center' },
  seat: { alignItems: 'center', width: 60, gap: 2 },
  seatName: { color: '#fff', fontSize: 11, fontWeight: '700' },
  seatState: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  card: { backgroundColor: PANEL, borderWidth: 1, borderColor: wolf.border, borderRadius: radius.md, padding: 12, gap: 6, marginHorizontal: 16, marginVertical: 4 },
  overCard: { position: 'absolute', left: 0, right: 0, bottom: 24, marginHorizontal: 24 },
  cardTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dim: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  dimCenter: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 24 },
  noticeBar: { backgroundColor: PANEL, borderRadius: radius.sm, padding: 8, gap: 2, marginHorizontal: 16 },
  notice: { color: wolf.gold, fontSize: 12, fontWeight: '600' },
  feed: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.md, marginHorizontal: 16, marginTop: 4 },
  hostLine: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontStyle: 'italic' },
  bubble: { backgroundColor: PANEL, borderRadius: radius.md, padding: 12 },
  from: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 4 },
  translated: { color: '#fff', fontSize: 17, fontWeight: '700' },
  original: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  revealLine: { color: '#fff', fontSize: 13 },
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16, paddingTop: 8 },
});
