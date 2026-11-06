import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisClient } from '../redis/redis-client.js';

export const RATE_LIMIT_METADATA = 'RATE_LIMIT_METADATA';

export interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_METADATA, options);

/**
 * Fixed-window rate limiter backed by Redis, shared across all instances.
 *
 * Fails OPEN: a Redis outage must not take down authentication endpoints.
 * Register as an APP_GUARD BEFORE SecurityGuard so abusive traffic is
 * rejected before any JWT verification work.
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!options) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<{ ip?: string }>();
    const key = `rate-limit:v1:${options.bucket}:${req.ip ?? 'unknown'}`;

    try {
      const count = await this.redis.connection.incr(key);
      if (count === 1) {
        await this.redis.connection.pexpire(key, options.windowMs);
      }
      if (count > options.limit) {
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return true;
    }
  }
}
