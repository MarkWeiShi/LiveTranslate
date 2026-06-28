import type {
  AttributionBody,
  AttributionDto,
  FunnelEventBody,
  CreateRoomResponse,
  JoinRoomResponse,
  WolfActionType,
  WolfCreateResponse,
  WolfJoinResponse,
  WolfStatePayload,
  GrowthProfileDto,
  AwardXpResult,
  BondDto,
  FamilyDto,
  FamilyLeaderboardDto,
  CallMode,
  CallSessionDto,
  CreateCallResponse,
  DiscoveryQuery,
  EndCallResponse,
  FriendDto,
  LoginResponse,
  MeDto,
  ReportReason,
  SendGiftResponse,
  UserCard,
  WalletDto,
  RechargeResponse,
} from '@linku/shared';
import { apiFetch } from './client';

function qs(q: Record<string, unknown>): string {
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  loginMock: (mockUserId: string) =>
    apiFetch<LoginResponse>('POST', '/auth/hellotalk/callback', { mockUserId }),
  loginTelegram: (tgWebAppData: string) =>
    apiFetch<LoginResponse>('POST', '/auth/telegram', { tgWebAppData }),
  reportAttribution: (b: AttributionBody) =>
    apiFetch<AttributionDto>('POST', '/attribution', b),
  reportFunnelEvent: (b: FunnelEventBody) =>
    apiFetch<{ ok: true }>('POST', '/attribution/event', b),
  // 巴别塔语聊房
  createRoom: () => apiFetch<CreateRoomResponse>('POST', '/rooms'),
  joinRoom: (id: string, language: string) =>
    apiFetch<JoinRoomResponse>('POST', `/rooms/${id}/join`, { language }),
  roomUtterance: (id: string, text: string) =>
    apiFetch<{ recipients: number }>('POST', `/rooms/${id}/utterance`, { text }),
  leaveRoom: (id: string) => apiFetch<void>('POST', `/rooms/${id}/leave`),
  // 玩法层
  roomBarrage: (id: string, text: string) =>
    apiFetch<{ recipients: number }>('POST', `/rooms/${id}/barrage`, { text }),
  roomRaiseHand: (id: string) => apiFetch<{ ok: true }>('POST', `/rooms/${id}/raise-hand`),
  roomLowerHand: (id: string) => apiFetch<{ ok: true }>('POST', `/rooms/${id}/lower-hand`),
  telephoneStart: (id: string, text: string) =>
    apiFetch<{ gameId: string }>('POST', `/rooms/${id}/telephone/start`, { text }),
  telephonePass: (id: string, gameId: string, text: string) =>
    apiFetch<{ done: boolean }>('POST', `/rooms/${id}/telephone/pass`, { gameId, text }),
  quizStart: (id: string) => apiFetch<{ quizId: string }>('POST', `/rooms/${id}/quiz/start`),
  quizAnswer: (id: string, questionId: string, choice: number) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/quiz/answer`, { questionId, choice }),
  roomGift: (id: string, giftType: string, toUserId?: string | null) =>
    apiFetch<{ ok: true; balance: number }>('POST', `/rooms/${id}/gift`, { giftType, toUserId }),
  // 座位制
  micApply: (id: string, seatIndex?: number | null) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/apply`, { seatIndex }),
  micApprove: (id: string, userId: string, seatIndex?: number | null) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/approve`, { userId, seatIndex }),
  micReject: (id: string, userId: string) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/reject`, { userId }),
  micLeave: (id: string) => apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/leave`),
  micMute: (id: string, seatIndex: number, muted: boolean) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/mute`, { seatIndex, muted }),
  micKick: (id: string, seatIndex: number) =>
    apiFetch<{ ok: true }>('POST', `/rooms/${id}/mic/kick`, { seatIndex }),
  // 跨语言狼人杀
  wolfCreate: (boardKey: string, language: string) =>
    apiFetch<WolfCreateResponse>('POST', '/werewolf', { boardKey, language }),
  wolfJoin: (id: string, language: string) =>
    apiFetch<WolfJoinResponse>('POST', `/werewolf/${id}/join`, { language }),
  wolfStart: (id: string) => apiFetch<{ ok: true }>('POST', `/werewolf/${id}/start`),
  wolfState: (id: string) => apiFetch<WolfStatePayload>('GET', `/werewolf/${id}`),
  wolfNightAction: (
    id: string,
    body: { action: WolfActionType; targetSeat?: number; save?: boolean; poisonSeat?: number },
  ) => apiFetch<{ ok: true }>('POST', `/werewolf/${id}/night-action`, body),
  wolfSpeak: (id: string, text: string) =>
    apiFetch<{ ok: true }>('POST', `/werewolf/${id}/speak`, { text }),
  wolfPass: (id: string) => apiFetch<{ ok: true }>('POST', `/werewolf/${id}/pass`),
  wolfVote: (id: string, targetSeat: number | null) =>
    apiFetch<{ ok: true }>('POST', `/werewolf/${id}/vote`, { targetSeat }),
  wolfLeave: (id: string) => apiFetch<void>('POST', `/werewolf/${id}/leave`),
  // 充值（Telegram Stars / dev mock）
  walletRecharge: (packId: string) =>
    apiFetch<RechargeResponse>('POST', '/wallet/recharge', { packId }),
  walletRechargeDev: (packId: string) =>
    apiFetch<WalletDto>('POST', '/wallet/recharge/dev', { packId }),
  // 成长体系
  growthMe: () => apiFetch<GrowthProfileDto>('GET', '/growth/me'),
  growthAward: (amount: number, reason?: string) =>
    apiFetch<AwardXpResult>('POST', '/growth/award', { amount, reason }),
  growthBond: (peerId: string, amount?: number) =>
    apiFetch<BondDto>('POST', '/growth/bond', { peerId, amount }),
  createFamily: (name: string) => apiFetch<FamilyDto>('POST', '/families', { name }),
  joinFamily: (id: string) => apiFetch<FamilyDto>('POST', `/families/${id}/join`),
  contributeFamily: (id: string, amount: number) =>
    apiFetch<FamilyDto>('POST', `/families/${id}/contribute`, { amount }),
  familyLeaderboard: () => apiFetch<FamilyLeaderboardDto>('GET', '/families/leaderboard'),
  me: () => apiFetch<MeDto>('GET', '/users/me'),
  updateMe: (b: Partial<{ intent: string; bio: string; nativeLanguage: string; learningLanguages: string[] }>) =>
    apiFetch<UserCard>('PATCH', '/users/me', b),
  discovery: (q: DiscoveryQuery) =>
    apiFetch<UserCard[]>('GET', `/discovery${qs(q as Record<string, unknown>)}`),
  user: (id: string) => apiFetch<UserCard>('GET', `/users/${id}`),
  heartbeat: (availableForCall = true) =>
    apiFetch<void>('POST', '/presence/heartbeat', { availableForCall }),
  createCall: (calleeId: string, mode: CallMode) =>
    apiFetch<CreateCallResponse>('POST', '/calls', { calleeId, mode }),
  acceptCall: (id: string) =>
    apiFetch<{ livekitToken: string; room: string }>('POST', `/calls/${id}/accept`),
  declineCall: (id: string) => apiFetch<void>('POST', `/calls/${id}/decline`),
  endCall: (id: string, reason?: string) =>
    apiFetch<EndCallResponse>('POST', `/calls/${id}/end`, { reason }),
  toggleTranslation: (id: string, on: boolean) =>
    apiFetch<{ paywall: boolean }>('POST', `/calls/${id}/translation/toggle`, { on }),
  history: () => apiFetch<CallSessionDto[]>('GET', '/calls/history'),
  wallet: () => apiFetch<WalletDto>('GET', '/wallet'),
  iapVerify: (receipt: string) => apiFetch<WalletDto>('POST', '/iap/verify', { receipt }),
  sendGift: (id: string, giftType: string) =>
    apiFetch<SendGiftResponse>('POST', `/calls/${id}/gift`, { giftType }),
  report: (b: { targetId: string; callId?: string; reason: ReportReason; detail?: string }) =>
    apiFetch<{ id: string }>('POST', '/reports', b),
  block: (blockedUserId: string) => apiFetch<unknown>('POST', '/blocks', { blockedUserId }),
  friends: () => apiFetch<FriendDto[]>('GET', '/friends'),
  addFriend: (friendId: string) => apiFetch<FriendDto>('POST', '/friends', { friendId }),
};
