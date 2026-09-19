import { Module } from '@nestjs/common';
import { REALTIME_PROVIDER } from '../../modules/voice/index.js';
import { LivekitAdapter } from './livekit.adapter.js';
@Module({
  providers: [LivekitAdapter, { provide: REALTIME_PROVIDER, useExisting: LivekitAdapter }],
  exports: [REALTIME_PROVIDER],
})
export class LivekitModule {}
