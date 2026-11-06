import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { sdk } from './telemetry.js';

@Injectable()
export class OpenTelemetryShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await sdk.shutdown();
  }
}
