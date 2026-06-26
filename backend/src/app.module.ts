import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AdaptersModule } from './adapters/adapters.module';
import { EmitterModule } from './realtime/emitter.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PresenceModule } from './presence/presence.module';
import { SafetyModule } from './safety/safety.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { CallsModule } from './calls/calls.module';
import { TranslationModule } from './translation/translation.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WalletModule } from './wallet/wallet.module';
import { GiftsModule } from './gifts/gifts.module';
import { FriendsModule } from './friends/friends.module';
import { AttributionModule } from './attribution/attribution.module';
import { RoomsModule } from './rooms/rooms.module';
import { GrowthModule } from './growth/growth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AdaptersModule,
    EmitterModule,
    AuthModule,
    UsersModule,
    PresenceModule,
    SafetyModule,
    DiscoveryModule,
    CallsModule,
    TranslationModule,
    RealtimeModule,
    WalletModule,
    GiftsModule,
    FriendsModule,
    AttributionModule,
    RoomsModule,
    GrowthModule,
  ],
})
export class AppModule {}
