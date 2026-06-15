import type { Gender } from '@linku/shared';

/** Normalized profile returned by any AuthProvider (HelloTalk UserInfo mapping, §3.2). */
export interface HelloTalkProfile {
  sub: string; // -> helloTalkUserId (unique)
  displayName: string;
  avatarUrl?: string;
  nativeLanguage: string;
  learningLanguages: string[];
  languageLevel?: string;
  gender: Gender;
  region?: string;
  timezone?: string;
  bio?: string;
  interests: string[];
  realPersonVerified: boolean;
  trustScore: number;
}

export interface ExchangeInput {
  code?: string;
  mockUserId?: string;
}

export interface AuthProvider {
  exchangeCode(input: ExchangeInput): Promise<HelloTalkProfile>;
}
