import type { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import type { RedisClient } from '@/shared/infrastructure/redis/redis-client.js';
import { RedisExchangeRateCache } from './redis-exchange-rate.cache.js';

describe('RedisExchangeRateCache', () => {
  const entry = {
    numerator: 73n,
    denominator: 80n,
    provider: 'frankfurter',
    quotedAt: new Date('2026-11-03T00:00:00.000Z'),
    cachedAt: new Date('2026-11-03T12:00:00.000Z'),
  };

  function setup() {
    const connection = {
      get: vitest.fn(),
      set: vitest.fn().mockResolvedValue('OK'),
      del: vitest.fn().mockResolvedValue(1),
    };
    const logger = { info: vitest.fn(), warn: vitest.fn(), error: vitest.fn(), debug: vitest.fn() };
    const cache = new RedisExchangeRateCache(
      { connection } as unknown as RedisClient,
      logger as unknown as ApplicationLogger,
    );
    return { cache, connection, logger };
  }

  test('serializes BigInt rational values as decimal strings and stores with millisecond TTL', async () => {
    const { cache, connection } = setup();

    await cache.save('USD', 'EUR', entry, 7 * 24 * 60 * 60 * 1_000);

    const [key, raw, mode, ttl] = connection.set.mock.calls[0];
    expect(key).toBe('expense-group:exchange-rate:frankfurter:v1:USD:EUR');
    expect(JSON.parse(raw)).toEqual({
      numerator: '73',
      denominator: '80',
      provider: 'frankfurter',
      quotedAt: entry.quotedAt.toISOString(),
      cachedAt: entry.cachedAt.toISOString(),
    });
    expect([mode, ttl]).toEqual(['PX', 7 * 24 * 60 * 60 * 1_000]);
  });

  test('rehydrates cached rational values and timestamps', async () => {
    const { cache, connection } = setup();
    connection.get.mockResolvedValue(
      JSON.stringify({
        numerator: '73',
        denominator: '80',
        provider: 'frankfurter',
        quotedAt: entry.quotedAt.toISOString(),
        cachedAt: entry.cachedAt.toISOString(),
      }),
    );

    await expect(cache.find('USD', 'EUR')).resolves.toEqual(entry);
    expect(connection.get).toHaveBeenCalledWith('expense-group:exchange-rate:frankfurter:v1:USD:EUR');
  });

  test('discards malformed entries instead of returning invalid values', async () => {
    const { cache, connection, logger } = setup();
    connection.get.mockResolvedValue('{not-json');

    await expect(cache.find('USD', 'EUR')).resolves.toBeNull();
    expect(connection.del).toHaveBeenCalledWith('expense-group:exchange-rate:frankfurter:v1:USD:EUR');
    expect(logger.warn).toHaveBeenCalledWith('expense_group.fx.cache.entry_invalid', {
      base_currency: 'USD',
      quote_currency: 'EUR',
    });
  });

  test('rejects invalid cache retention periods', async () => {
    const { cache } = setup();

    await expect(cache.save('USD', 'EUR', entry, 0)).rejects.toThrow(RangeError);
  });
});
