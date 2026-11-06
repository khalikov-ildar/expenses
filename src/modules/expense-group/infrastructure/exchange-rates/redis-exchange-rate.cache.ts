import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { CachedExchangeRate, ExchangeRateCache } from '../../application/ports/exchange-rate-cache.js';
import { RedisClient } from '@/shared/infrastructure/redis/redis-client.js';

const CACHE_KEY_PREFIX = 'expense-group:exchange-rate:frankfurter:v1';

const isoTimestampSchema = z.string().refine((value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});

const cachedExchangeRateSchema = z.object({
  numerator: z.string().regex(/^[1-9]\d*$/),
  denominator: z.string().regex(/^[1-9]\d*$/),
  provider: z.string().min(1),
  quotedAt: isoTimestampSchema,
  cachedAt: isoTimestampSchema,
});

/** Redis adapter. BigInt values are serialized as decimal strings (JSON has no BigInt support). */
@Injectable()
export class RedisExchangeRateCache implements ExchangeRateCache {
  constructor(
    private readonly redis: RedisClient,
    private readonly logger: ApplicationLogger,
  ) {}

  async find(baseCode: string, quoteCode: string): Promise<CachedExchangeRate | null> {
    const key = this.getKey(baseCode, quoteCode);
    const raw = await this.redis.connection.get(key);
    if (raw === null) return null;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      await this.discardInvalidEntry(key, baseCode, quoteCode);
      return null;
    }

    const parsed = cachedExchangeRateSchema.safeParse(payload);
    if (!parsed.success) {
      await this.discardInvalidEntry(key, baseCode, quoteCode);
      return null;
    }

    return {
      numerator: BigInt(parsed.data.numerator),
      denominator: BigInt(parsed.data.denominator),
      provider: parsed.data.provider,
      quotedAt: new Date(parsed.data.quotedAt),
      cachedAt: new Date(parsed.data.cachedAt),
    };
  }

  async save(
    baseCode: string,
    quoteCode: string,
    entry: CachedExchangeRate,
    ttlMs: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      throw new RangeError('Exchange-rate cache TTL must be a positive safe integer.');
    }

    const value = JSON.stringify({
      numerator: entry.numerator.toString(),
      denominator: entry.denominator.toString(),
      provider: entry.provider,
      quotedAt: entry.quotedAt.toISOString(),
      cachedAt: entry.cachedAt.toISOString(),
    });

    await this.redis.connection.set(this.getKey(baseCode, quoteCode), value, 'PX', ttlMs);
  }

  private getKey(baseCode: string, quoteCode: string): string {
    return `${CACHE_KEY_PREFIX}:${baseCode}:${quoteCode}`;
  }

  private async discardInvalidEntry(key: string, baseCode: string, quoteCode: string): Promise<void> {
    this.logger.warn('expense_group.fx.cache.entry_invalid', {
      base_currency: baseCode,
      quote_currency: quoteCode,
    });

    try {
      await this.redis.connection.del(key);
    } catch (error) {
      this.logger.error(
        'expense_group.fx.cache.invalid_entry_delete_failed',
        { base_currency: baseCode, quote_currency: quoteCode },
        error,
      );
    }
  }
}
