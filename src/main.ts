import './shared/infrastructure/instrumentation/telemetry.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@app/app.module.js';
import { enhanceApp } from '@app/enhance-app.js';
import { AppConfig } from './shared/infrastructure/config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  enhanceApp(app);
  const config = app.get(AppConfig);

  await app.listen(config.serverPort, config.serverHost);
}
await bootstrap();
