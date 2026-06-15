// Data contracts shared by backend responses and app types (BuildSpec §4 / §5.1).
import type {
  CallMode,
  CallStatus,
  Gender,
  Intent,
  ReportReason,
  SubTier,
} from './enums';

/** Public-facing user card (arrays exposed as string[], not JSON strings). */
export interface UserCard {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  nativeLanguage: string;
  learningLanguages: string[];
  languageLevel?: string | null;
  gender: Gender;
  region?: string | null;
  timezone?: string | null;
  bio?: string | null;
  interests: string[];
  realPersonVerified: boolean;
  trustScore: number;
  intent: Intent;
  // discovery/detail enrichments
  online?: boolean;
  availableForCall?: boolean;
  blocked?: boolean;
}

export interface WalletDto {
  userId: string;
  diamonds: number;
  trialSecondsLeft: number;
  subscriptionTier: SubTier;
  subscriptionExpiry?: string | null;
}

export interface MeDto extends UserCard {
  wallet: WalletDto;
}

export interface LoginResponse {
  token: string;
  user: UserCard;
  isNewUser: boolean;
}

export interface CallSessionDto {
  id: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
  status: CallStatus;
  translationOn: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSec: number;
  translatedSec: number;
  createdAt: string;
  // joined peer card for history rendering
  peer?: UserCard;
}

export interface CreateCallResponse {
  callId: string;
  livekitToken: string;
  room: string;
  callee?: UserCard;
}

export interface EndCallResponse {
  durationSec: number;
  translatedSec: number;
}

export interface GiftDto {
  id: string;
  callId: string;
  fromId: string;
  toId: string;
  giftType: string;
  diamonds: number;
  createdAt: string;
}

export interface SendGiftResponse {
  wallet: WalletDto;
  gift: GiftDto;
}

export interface BlockDto {
  id: string;
  userId: string;
  blockedUserId: string;
  createdAt: string;
  blockedUser?: UserCard;
}

export interface FriendDto extends UserCard {
  friendshipId: string;
  friendStatus: string;
}

// ---- Request bodies ----
export interface HelloTalkCallbackBody {
  code?: string;
  mockUserId?: string;
}

export interface UpdateMeBody {
  intent?: Intent;
  bio?: string;
  nativeLanguage?: string;
  learningLanguages?: string[];
}

export interface DiscoveryQuery {
  lang?: string;
  gender?: Gender;
  onlineOnly?: boolean;
  page?: number;
}

export interface CreateCallBody {
  calleeId: string;
  mode: CallMode;
}

export interface EndCallBody {
  reason?: string;
}

export interface ToggleTranslationBody {
  on: boolean;
}

export interface IapVerifyBody {
  receipt: string;
}

export interface SendGiftBody {
  giftType: string;
}

export interface CreateReportBody {
  targetId: string;
  callId?: string;
  reason: ReportReason;
  detail?: string;
}

export interface CreateBlockBody {
  blockedUserId: string;
}

export interface HeartbeatBody {
  availableForCall: boolean;
}
