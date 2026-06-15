import type { HelloTalkProfile } from './auth-provider.interface';

// BuildSpec §11 seed users. Single source consumed by MockAuthProvider AND prisma/seed.ts.
export interface SeedProfile extends HelloTalkProfile {
  // initial wallet + presence hints (presence applied by app heartbeat / e2e harness)
  initialDiamonds: number;
  trialSecondsLeft: number;
  presenceOnline: boolean;
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    sub: 'seed_male_01',
    displayName: 'Wei (魏)',
    avatarUrl: 'https://i.pravatar.cc/300?img=12',
    nativeLanguage: 'zh',
    learningLanguages: ['es', 'en'],
    languageLevel: 'B1',
    gender: 'MALE',
    region: 'CN',
    timezone: 'Asia/Shanghai',
    bio: '喜欢旅行和摄影，想认识世界各地的朋友。',
    interests: ['travel', 'photography', 'food'],
    realPersonVerified: true,
    trustScore: 80,
    initialDiamonds: 0,
    trialSecondsLeft: 420,
    presenceOnline: true,
  },
  {
    sub: 'seed_female_01',
    displayName: 'María',
    avatarUrl: 'https://i.pravatar.cc/300?img=45',
    nativeLanguage: 'es',
    learningLanguages: ['zh', 'en'],
    languageLevel: 'A2',
    gender: 'FEMALE',
    region: 'MX',
    timezone: 'America/Mexico_City',
    bio: 'Me encanta la música y aprender idiomas nuevos.',
    interests: ['music', 'dance', 'languages'],
    realPersonVerified: true,
    trustScore: 85,
    initialDiamonds: 0,
    trialSecondsLeft: 420,
    presenceOnline: true,
  },
  {
    sub: 'seed_female_02',
    displayName: 'Emily',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    nativeLanguage: 'en',
    learningLanguages: ['zh'],
    languageLevel: 'B2',
    gender: 'FEMALE',
    region: 'US',
    timezone: 'America/New_York',
    bio: 'Coffee, books and good conversations.',
    interests: ['books', 'coffee', 'movies'],
    realPersonVerified: true,
    trustScore: 60,
    initialDiamonds: 0,
    trialSecondsLeft: 420,
    presenceOnline: true,
  },
  {
    sub: 'seed_female_03',
    displayName: 'Layla',
    avatarUrl: 'https://i.pravatar.cc/300?img=44',
    nativeLanguage: 'ar',
    learningLanguages: ['en'],
    languageLevel: 'A1',
    gender: 'FEMALE',
    region: 'AE',
    timezone: 'Asia/Dubai',
    bio: 'مرحبا! أحب السفر.',
    interests: ['travel', 'art'],
    realPersonVerified: false,
    trustScore: 40,
    initialDiamonds: 0,
    trialSecondsLeft: 420,
    presenceOnline: false, // offline: tests "not callable" + sorts last (AC-DISC-1)
  },
];

export const SEED_BY_ID: Record<string, SeedProfile> = Object.fromEntries(
  SEED_PROFILES.map((p) => [p.sub, p]),
);
