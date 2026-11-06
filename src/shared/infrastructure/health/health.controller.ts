import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { PrismaClientProvider } from '../database/transaction/prisma.client-provider.js';
import { RedisClient } from '../redis/redis-client.js';
import { db } from '../database/prisma/db.js';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaClientProvider,
    private readonly redis: RedisClient,
  ) {}

  @Get('health')
  @SecureEndpoint({ auth: AuthTypes.NONE })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @SecureEndpoint({ auth: AuthTypes.NONE })
  async ready() {
    const checks: Record<string, boolean> = {};

    try {
      await this.prisma.runtime.query(db.raw.sql`SELECT 1`.affectedCount().build());
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      checks.redis = (await this.redis.connection.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }

    const ok = Object.values(checks).every(Boolean);
    if (!ok) {
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }

    return { status: 'ready', checks };
  }
}
