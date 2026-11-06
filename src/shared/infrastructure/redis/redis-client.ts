import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { RedisConfig } from '@/shared/infrastructure/config/env.schema.js';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

/**
 * Shared Redis connection for application-owned cache adapters.
 * BullMQ keeps its own managed connections, configured from the same RedisConfig.
 */
@Injectable()
export class RedisClient implements OnModuleDestroy {
  readonly connection: IORedis.Redis;

  constructor(config: RedisConfig, logger: ApplicationLogger) {
    this.connection = new IORedis.Redis({
      host: config.redisHost,
      port: config.redisPort,
      // username: config.redisUsername,
      password: config.redisPassword,
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
    });

    this.connection.on('error', (error) => {
      logger.error('shared.redis.connection_error', { component: 'redis_client' }, error);
    });
  }

  onModuleDestroy(): void {
    // Disconnect immediately: the application may be shutting down while Redis
    // is unavailable, so waiting for a graceful QUIT handshake is unsafe.
    this.connection.disconnect();
  }
}
