import { DomainErrorCategory } from '@/shared/domain/domain-error.js';
import type { Clock } from '@/shared/domain/clock.js';
import type { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Currency } from '../../domain/currency.js';
import type { ExchangeRateCache } from '../../application/ports/exchange-rate-cache.js';
import { FrankfurterExchangeRateProvider } from './frankfurter.exchange-rate.provider.js';
import type { FrankfurterApiClient } from './frankfurter/frankfurter-api.client.js';
import type { ExchangeRateSnapshot } from './frankfurter/frankfurter-rate.mapper.js';
import { FrankfurterHttpError, FrankfurterProtocolError, FrankfurterTransportError } from './frankfurter/frankfurter.errors.js';

describe('FrankfurterExchangeRateProvider', () => {
  const from = Currency.create('USD');
  const to = Currency.create('EUR');
  const now = new Date('2026-11-03T12:00:00.000Z');
  const liveSnapshot: ExchangeRateSnapshot = {
    numerator: 91n,
    denominator: 100n,
    provider: 'frankfurter',
    quotedAt: new Date('2026-11-03T00:00:00.000Z'),
  };
  const cachedQuote = (cachedAt: Date) => ({
    numerator: 9n,
    denominator: 10n,
    provider: 'frankfurter',
    quotedAt: new Date('2026-11-02T00:00:00.000Z'),
    cachedAt,
  });

  function setup(options?: {
    cached?: ReturnType<typeof cachedQuote> | null;
    cacheReadError?: Error;
    cacheWriteError?: Error;
    apiError?: Error;
    apiDelay?: Promise<ExchangeRateSnapshot>;
  }) {
    const cache = {
      find: vitest.fn().mockImplementation(async () => {
        if (options?.cacheReadError) throw options.cacheReadError;
        return options?.cached ?? null;
      }),
      save: vitest.fn().mockImplementation(async () => {
        if (options?.cacheWriteError) throw options.cacheWriteError;
      }),
    };
    const apiClient = {
      getRate: vitest.fn().mockImplementation(async () => {
        if (options?.apiDelay) return options.apiDelay;
        if (options?.apiError) throw options.apiError;
        return liveSnapshot;
      }),
    };
    const clock = { now: () => new Date(now) };
    const logger = {
      info: vitest.fn(),
      warn: vitest.fn(),
      error: vitest.fn(),
      debug: vitest.fn(),
    };

    const provider = new FrankfurterExchangeRateProvider(
      apiClient as unknown as FrankfurterApiClient,
      cache as unknown as ExchangeRateCache,
      clock as Clock,
      logger as unknown as ApplicationLogger,
    );

    return { provider, cache, apiClient, logger };
  }

  test('returns a fresh cached quote without calling Frankfurter', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 60 * 60 * 1_000));
    const { provider, cache, apiClient } = setup({ cached });

    const rate = await provider.getRate(from, to);

    expect(rate.numerator).toBe(9n);
    expect(rate.denominator).toBe(10n);
    expect(apiClient.getRate).not.toHaveBeenCalled();
    expect(cache.save).not.toHaveBeenCalled();
  });

  test('refreshes a stale cache entry and retains the new value for the fallback window', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 8 * 60 * 60 * 1_000));
    const { provider, cache, apiClient } = setup({ cached });

    const rate = await provider.getRate(from, to);

    expect(rate.numerator).toBe(liveSnapshot.numerator);
    expect(apiClient.getRate).toHaveBeenCalledOnce();
    expect(cache.save).toHaveBeenCalledWith(
      'USD',
      'EUR',
      expect.objectContaining({ numerator: 91n, denominator: 100n, cachedAt: now }),
      7 * 24 * 60 * 60 * 1_000,
    );
  });

  test('uses an eligible cached quote only for transient upstream failures', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1_000));
    const { provider, logger } = setup({ cached, apiError: new FrankfurterTransportError(new Error('ECONNRESET')) });

    const rate = await provider.getRate(from, to);

    expect(rate.numerator).toBe(9n);
    expect(logger.warn).toHaveBeenCalledWith(
      'expense_group.fx.stale_cache_fallback_used',
      expect.objectContaining({ base_currency: 'USD', quote_currency: 'EUR' }),
    );
  });

  test('does not use a cached quote older than the fallback limit', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1_000));
    const { provider } = setup({ cached, apiError: new FrankfurterTransportError(new Error('ECONNRESET')) });

    await expect(provider.getRate(from, to)).rejects.toMatchObject({
      code: 'expense_group.fx.rate_unavailable',
      category: DomainErrorCategory.UNAVAILABLE,
    });
  });

  test('does not use stale cache for permanent HTTP failures', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 60 * 60 * 1_000));
    const { provider } = setup({ cached, apiError: new FrankfurterHttpError(400) });

    await expect(provider.getRate(from, to)).rejects.toMatchObject({
      category: DomainErrorCategory.UNAVAILABLE,
    });
  });

  test('returns service unavailable when there is no fallback for a network outage', async () => {
    const { provider } = setup({ apiError: new FrankfurterTransportError(new Error('ECONNRESET')) });

    await expect(provider.getRate(from, to)).rejects.toMatchObject({
      code: 'expense_group.fx.rate_unavailable',
      category: DomainErrorCategory.UNAVAILABLE,
    });
  });

  test('does not use cached data for malformed upstream payloads', async () => {
    const cached = cachedQuote(new Date(now.getTime() - 60 * 60 * 1_000));
    const { provider } = setup({
      cached,
      apiError: new FrankfurterProtocolError('Frankfurter returned invalid JSON.'),
    });

    await expect(provider.getRate(from, to)).rejects.toMatchObject({
      category: DomainErrorCategory.UNAVAILABLE,
    });
  });

  test('continues with a live quote when Redis read fails', async () => {
    const { provider, apiClient, logger } = setup({ cacheReadError: new Error('Redis unavailable') });

    const rate = await provider.getRate(from, to);

    expect(rate.numerator).toBe(91n);
    expect(apiClient.getRate).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      'expense_group.fx.cache.read_failed',
      { base_currency: 'USD', quote_currency: 'EUR' },
      expect.any(Error),
    );
  });

  test('does not fail a successful live quote when Redis write fails', async () => {
    const { provider, logger } = setup({ cacheWriteError: new Error('Redis unavailable') });

    const rate = await provider.getRate(from, to);

    expect(rate.numerator).toBe(91n);
    expect(logger.error).toHaveBeenCalledWith(
      'expense_group.fx.cache.write_failed',
      { base_currency: 'USD', quote_currency: 'EUR' },
      expect.any(Error),
    );
  });

  test('coalesces concurrent requests for the same currency pair', async () => {
    let resolveRequest!: (value: ExchangeRateSnapshot) => void;
    const pending = new Promise<ExchangeRateSnapshot>((resolve) => {
      resolveRequest = resolve;
    });
    const { provider, apiClient } = setup({ apiDelay: pending });

    const first = provider.getRate(from, to);
    const second = provider.getRate(from, to);
    expect(apiClient.getRate).toHaveBeenCalledOnce();

    resolveRequest(liveSnapshot);
    const [firstRate, secondRate] = await Promise.all([first, second]);

    expect(firstRate).toBe(secondRate);
  });

  test('rejects an unnecessary same-currency quote', async () => {
    const { provider, apiClient } = setup();

    await expect(provider.getRate(from, from)).rejects.toMatchObject({
      code: 'expense_group.fx.same_currency_quote',
    });
    expect(apiClient.getRate).not.toHaveBeenCalled();
  });
});
