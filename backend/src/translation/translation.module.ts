import { forwardRef, Module } from '@nestjs/common';
import { TranslationSessionService } from './translation-session.service';
import { TranslationController } from './translation.controller';
import { SafetyModule } from '../safety/safety.module';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [SafetyModule, forwardRef(() => CallsModule)],
  providers: [TranslationSessionService],
  controllers: [TranslationController],
  exports: [TranslationSessionService],
})
export class TranslationModule {}
