import { ApplicationLogger } from './application/ports/application-logger.js';
import { OutboxRepository } from './application/ports/outbox.repository.js';
import { TransactionManager } from './application/ports/transaction-manager.js';
import { Clock, DateClock } from './domain/clock.js';
import { AlsApplicationContextAccessor } from './infrastructure/context/als.application-context.js';
import { PrismaClientProvider } from './infrastructure/database/transaction/prisma.client-provider.js';
import { PrismaTransactionManager } from './infrastructure/database/transaction/prisma.transaction-manager.js';
import { TransactionContextInterceptor } from './infrastructure/database/transaction/transaction-context.interceptor.js';
import { DomainErrorFilter } from './infrastructure/filters/domain-error.filter.js';
import { HealthController } from './infrastructure/health/health.controller.js';
import { OpenTelemetryShutdown } from './infrastructure/instrumentation/otel-shutdown.js';
import { RequestIdSpanInterceptor } from './infrastructure/instrumentation/request-id-span.interceptor.js';
import { createLoggerConfig } from './infrastructure/logging/logger.config.js';
import { PinoApplicationLogger } from './infrastructure/logging/pino.application-logger.js';
import { PrismaOutboxRepository } from './infrastructure/repositories/prisma-outbox.repo.js';
import { RedisClient } from './infrastructure/redis/redis-client.js';
import { RedisRateLimitGuard } from './infrastructure/security/rate-limit.guard.js';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueOptions } from 'bullmq';
import { LoggerModule } from 'nestjs-pino';
import {
  AccessTokenConfig,
  AppConfig,
  AuthCookieConfig,
  createAppConfig,
  DatabaseConfig,
  EmailVerificationConfig,
  EnvironmentConfig,
  envSchema,
  LoggerConfig,
  OAuthConfig,
  OutboxConfig,
  RedisConfig,
  RefreshTokenConfig,
  ServerConfig,
} from './infrastructure/config/env.schema.js';
import {
  ApplicationContextAccessor,
  AuthApplicationContext,
  BaseApplicationContext,
} from './application/ports/application-context.js';
import { ApplicationOutboxEventDispatcher } from '@/worker/outbox-event-dispatcher.js';
import { OutboxEventDispatcher } from './application/ports/outbox-event-dispatcher.js';

// Guard order matters: APP_GUARDs run in registration order. The rate
// limiter is registered first so abusive requests are rejected before
// any JWT verification or DB work happens.
const appProviders: Provider[] = [
  { provide: APP_GUARD, useClass: RedisRateLimitGuard },
  { provide: APP_INTERCEPTOR, useClass: RequestIdSpanInterceptor },
  { provide: APP_INTERCEPTOR, useClass: TransactionContextInterceptor },
  { provide: APP_FILTER, useClass: DomainErrorFilter },
];

const configs: Provider[] = [
  { provide: AppConfig, inject: [ConfigService], useFactory: createAppConfig },
  { provide: EnvironmentConfig, useExisting: AppConfig },
  { provide: ServerConfig, useExisting: AppConfig },
  { provide: LoggerConfig, useExisting: AppConfig },
  { provide: DatabaseConfig, useExisting: AppConfig },
  { provide: OutboxConfig, useExisting: AppConfig },
  { provide: RedisConfig, useExisting: AppConfig },
  { provide: AuthCookieConfig, useExisting: AppConfig },
  { provide: EmailVerificationConfig, useExisting: AppConfig },
  { provide: OAuthConfig, useExisting: AppConfig },
  { provide: AccessTokenConfig, useExisting: AppConfig },
  { provide: RefreshTokenConfig, useExisting: AppConfig },
];

@Global()
@Module({
  imports: [
    LoggerModule.forRoot(createLoggerConfig()),
    ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema: envSchema }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => {
        return {
          connection: {
            host: cfg.redisHost,
            port: cfg.redisPort,
            // username: cfg.redisUsername || undefined,
            password: cfg.redisPassword || undefined,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              age: 3600,
              count: 1000,
            },
            removeOnFail: {
              age: 24 * 3600,
            },
          },
        } satisfies QueueOptions;
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    PrismaTransactionManager,
    PrismaClientProvider,
    RedisClient,
    OpenTelemetryShutdown,
    AlsApplicationContextAccessor,
    { provide: TransactionManager, useExisting: PrismaTransactionManager },
    { provide: OutboxRepository, useClass: PrismaOutboxRepository },
    { provide: Clock, useClass: DateClock },
    ...configs,
    { provide: ApplicationContextAccessor, useExisting: AlsApplicationContextAccessor },
    { provide: BaseApplicationContext, useExisting: AlsApplicationContextAccessor },
    { provide: AuthApplicationContext, useExisting: AlsApplicationContextAccessor },
    { provide: ApplicationLogger, useClass: PinoApplicationLogger },
    ...appProviders,
  ],
  exports: [
    TransactionManager,
    PrismaTransactionManager,
    PrismaClientProvider,
    RedisClient,
    OutboxRepository,
    Clock,
    AppConfig,
    EnvironmentConfig,
    ServerConfig,
    LoggerConfig,
    DatabaseConfig,
    OutboxConfig,
    RedisConfig,
    AuthCookieConfig,
    EmailVerificationConfig,
    OAuthConfig,
    AccessTokenConfig,
    RefreshTokenConfig,
    AlsApplicationContextAccessor,
    ApplicationContextAccessor,
    BaseApplicationContext,
    AuthApplicationContext,
    ApplicationLogger,
  ],
})
export class SharedModule {}
