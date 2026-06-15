import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_PROVIDER,
  KV_STORE,
  MEDIA_TRANSPORT,
  PAYMENT_PROVIDER,
  PRESENCE_STORE,
  TRANSLATION_ENGINE,
} from '../config/provider.tokens';
import { MockAuthProvider } from './auth/mock-auth.provider';
import { HelloTalkAuthProvider } from './auth/hellotalk-auth.provider';
import { MockMediaTransport } from './media/mock-media.transport';
import { LiveKitMediaTransport } from './media/livekit-media.transport';
import { MockTranslationEngine } from './translation/mock-translation.engine';
import { GeminiTranslationEngine } from './translation/gemini-translation.engine';
import { MockPaymentProvider } from './payment/mock-payment.provider';
import { RevenueCatPaymentProvider } from './payment/revenuecat-payment.provider';
import { InMemoryKvStore } from './store/in-memory-kv.store';
import { InMemoryPresenceStore } from './store/in-memory-presence.store';

// All external dependencies bound here, env-selected. Consumers inject by token only.
@Global()
@Module({
  providers: [
    {
      provide: AUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        cfg.get('AUTH_PROVIDER') === 'hellotalk'
          ? new HelloTalkAuthProvider()
          : new MockAuthProvider(),
    },
    {
      provide: MEDIA_TRANSPORT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        cfg.get('MEDIA_PROVIDER') === 'livekit'
          ? new LiveKitMediaTransport()
          : new MockMediaTransport(),
    },
    {
      provide: TRANSLATION_ENGINE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        cfg.get('TRANSLATION_PROVIDER') === 'gemini'
          ? new GeminiTranslationEngine()
          : new MockTranslationEngine(),
    },
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        cfg.get('PAYMENT_PROVIDER') === 'revenuecat'
          ? new RevenueCatPaymentProvider()
          : new MockPaymentProvider(),
    },
    {
      provide: KV_STORE,
      useFactory: () => new InMemoryKvStore(),
    },
    {
      provide: PRESENCE_STORE,
      useFactory: () => new InMemoryPresenceStore(),
    },
  ],
  exports: [
    AUTH_PROVIDER,
    MEDIA_TRANSPORT,
    TRANSLATION_ENGINE,
    PAYMENT_PROVIDER,
    KV_STORE,
    PRESENCE_STORE,
  ],
})
export class AdaptersModule {}
