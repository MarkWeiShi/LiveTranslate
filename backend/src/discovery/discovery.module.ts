import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { PresenceModule } from '../presence/presence.module';
import { SafetyModule } from '../safety/safety.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PresenceModule, SafetyModule, UsersModule],
  providers: [DiscoveryService],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
