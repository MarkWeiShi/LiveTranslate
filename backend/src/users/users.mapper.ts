import type { User as PrismaUser, Wallet as PrismaWallet } from '@prisma/client';
import type {
  Gender,
  Intent,
  SubTier,
  UserCard,
  WalletDto,
} from '@linku/shared';
import { parseStrArr } from '../common/json-array.util';

export function toUserCard(u: PrismaUser): UserCard {
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    nativeLanguage: u.nativeLanguage,
    learningLanguages: parseStrArr(u.learningLanguages),
    languageLevel: u.languageLevel,
    gender: u.gender as Gender,
    region: u.region,
    timezone: u.timezone,
    bio: u.bio,
    interests: parseStrArr(u.interests),
    realPersonVerified: u.realPersonVerified,
    trustScore: u.trustScore,
    intent: u.intent as Intent,
  };
}

export function toWalletDto(w: PrismaWallet): WalletDto {
  return {
    userId: w.userId,
    diamonds: w.diamonds,
    trialSecondsLeft: w.trialSecondsLeft,
    subscriptionTier: w.subscriptionTier as SubTier,
    subscriptionExpiry: w.subscriptionExpiry
      ? w.subscriptionExpiry.toISOString()
      : null,
  };
}
