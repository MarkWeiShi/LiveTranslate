import { forwardRef, Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { SafetyModule } from '../safety/safety.module';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [
    UsersModule,
    PresenceModule,
    SafetyModule,
    forwardRef(() => TranslationModule),
  ],
  providers: [CallsService],
  controllers: [CallsController],
  exports: [CallsService],
})
export class CallsModule {}
