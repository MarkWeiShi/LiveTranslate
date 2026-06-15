import { Global, Module } from '@nestjs/common';
import { SocketRegistry } from './socket-registry';
import { RealtimeEmitter } from './realtime.emitter';

// Global so any module can inject RealtimeEmitter/SocketRegistry without import cycles.
@Global()
@Module({
  providers: [SocketRegistry, RealtimeEmitter],
  exports: [SocketRegistry, RealtimeEmitter],
})
export class EmitterModule {}
