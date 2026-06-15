import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignalingGateway } from './signaling.gateway';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [
    forwardRef(() => CallsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET') ?? 'dev_secret',
      }),
    }),
  ],
  providers: [SignalingGateway],
})
export class RealtimeModule {}
