import { InternalServerErrorException } from '@nestjs/common';
import type {
  AuthProvider,
  ExchangeInput,
  HelloTalkProfile,
} from './auth-provider.interface';

/** Real HelloTalk OIDC provider — stub. Flip AUTH_PROVIDER=hellotalk + provide creds to implement. */
export class HelloTalkAuthProvider implements AuthProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exchangeCode(_input: ExchangeInput): Promise<HelloTalkProfile> {
    throw new InternalServerErrorException({
      code: 'HELLOTALK_NOT_CONFIGURED',
      message:
        'HelloTalk OAuth not implemented in MVP. Set AUTH_PROVIDER=mock or implement OIDC code exchange + UserInfo->profile mapping (§3.2).',
    });
  }
}
