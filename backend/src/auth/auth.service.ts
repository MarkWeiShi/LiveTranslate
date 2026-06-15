import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@linku/shared';
import { AUTH_PROVIDER } from '../config/provider.tokens';
import type { AuthProvider, ExchangeInput } from '../adapters/auth/auth-provider.interface';
import { UsersService } from '../users/users.service';

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
}
