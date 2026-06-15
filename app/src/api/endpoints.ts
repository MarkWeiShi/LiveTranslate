import type {
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
