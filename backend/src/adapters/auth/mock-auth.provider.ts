import { UnauthorizedException } from '@nestjs/common';
import type {
  AuthProvider,
  ExchangeInput,
  HelloTalkProfile,
} from './auth-provider.interface';
import { SEED_BY_ID } from './seed-profiles';

/** Mock: ignores OAuth code; resolves a seed user by mockUserId (§3.1 mock branch). */
export class MockAuthProvider implements AuthProvider {
  async exchangeCode(input: ExchangeInput): Promise<HelloTalkProfile> {
    const id = input.mockUserId;
    if (!id || !SEED_BY_ID[id]) {
      throw new UnauthorizedException({
        code: 'UNKNOWN_MOCK_USER',
        message: `Unknown mockUserId "${id}". Use one of: ${Object.keys(SEED_BY_ID).join(', ')}`,
      });
    }
    const p = SEED_BY_ID[id];
    // return only the HelloTalkProfile-shaped fields
    return {
      sub: p.sub,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      nativeLanguage: p.nativeLanguage,
      learningLanguages: p.learningLanguages,
      languageLevel: p.languageLevel,
      gender: p.gender,
      region: p.region,
      timezone: p.timezone,
      bio: p.bio,
      interests: p.interests,
      realPersonVerified: p.realPersonVerified,
      trustScore: p.trustScore,
    };
  }
}
