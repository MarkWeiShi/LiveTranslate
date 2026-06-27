import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { parseTelegramInitData, type LoginResponse } from '@linku/shared';
import { AUTH_PROVIDER } from '../config/provider.tokens';
import type { AuthProvider, ExchangeInput, HelloTalkProfile } from '../adapters/auth/auth-provider.interface';
import { UsersService } from '../users/users.service';
import { verifyTelegramInitData } from '../attribution/telegram-verify';

const SUPPORTED_LANGS = ['zh', 'en', 'es', 'ar'];
function mapLang(code?: string): string {
  if (!code) return 'en';
  const c = code.toLowerCase();
  if (c.startsWith('zh')) return 'zh';
  return SUPPORTED_LANGS.includes(c) ? c : 'en';
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private authProvider: AuthProvider,
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async callback(input: ExchangeInput): Promise<LoginResponse> {
    const profile = await this.authProvider.exchangeCode(input);
    const { card, isNewUser } = await this.users.upsertFromProfile(profile);
    const token = await this.jwt.signAsync({ sub: card.id });
    return { token, user: card, isNewUser };
  }

  /** Telegram Mini App 自动登录：用 initData 换 JWT（登录身份 = Telegram 用户）。 */
  async telegram(tgWebAppData: string): Promise<LoginResponse> {
    // 校验模式：ATTRIBUTION_VERIFY=telegram + TELEGRAM_BOT_TOKEN 时做 HMAC（属 human checkpoint）。
    const verifyMode = process.env.ATTRIBUTION_VERIFY ?? 'mock';
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
    if (verifyMode === 'telegram') {
      const r = verifyTelegramInitData(tgWebAppData, botToken, { maxAgeSec: 86400 });
      if (!r.ok) throw new UnauthorizedException({ code: 'BAD_TELEGRAM_INITDATA', reason: r.reason });
    }

    const ctx = parseTelegramInitData(tgWebAppData);
    if (!ctx.user?.id) throw new BadRequestException({ code: 'NO_TELEGRAM_USER' });

    const profile: HelloTalkProfile = {
      sub: `tg:${ctx.user.id}`, // 唯一键 → 幂等再登录
      displayName: ctx.user.username || ctx.user.firstName || `TG${ctx.user.id}`,
      nativeLanguage: mapLang(ctx.user.languageCode),
      learningLanguages: [],
      gender: 'OTHER',
      realPersonVerified: false,
      trustScore: 50,
      interests: [],
    };
    const { card, isNewUser } = await this.users.upsertFromProfile(profile);
    const token = await this.jwt.signAsync({ sub: card.id });
    return { token, user: card, isNewUser };
  }
}
