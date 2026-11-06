import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Clock } from '@/shared/domain/clock.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { Injectable } from '@nestjs/common';
import { ExchangeRateCache } from '../../application/ports/exchange-rate-cache.js';
import type { CachedExchangeRate } from '../../application/ports/exchange-rate-cache.js';
import type { ExchangeRateProvider } from '../../application/ports/exchange-rate.provider.js';
import { Currency } from '../../domain/currency.js';
import { ExchangeRate } from '../../domain/exchange-rate.js';
import type { ExchangeRateSnapshot } from './frankfurter/frankfurter-rate.mapper.js';
import { FrankfurterApiClient } from './frankfurter/frankfurter-api.client.js';
import { isTransientFrankfurterFailure } from './frankfurter/frankfurter.errors.js';

/** How long a cached quote can be served without revalidating it upstream. */
const FRESH_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

/** Maximum age of a successfully fetched quote that may be used during an outage. */
const MAX_FALLBACK_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Coordinates cache-first reads, upstream refreshes, stale-if-error fallback,
 * and per-process request coalescing for the Frankfurter adapter.
 *
 * The cache retention is deliberately longer than the fresh TTL: stale values
 * must remain available while the provider is revalidated and during outages.
 */
@Injectable()
export class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
  private readonly inFlight = new Map<string, Promise<ExchangeRate>>();

  constructor(
    private readonly apiClient: FrankfurterApiClient,
    private readonly cache: ExchangeRateCache,
    private readonly clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async getRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    if (from.equals(to)) {
      throw DomainErrors.invalid(
        'expense_group.fx.same_currency_quote',
        'A quote is unnecessary for identical currencies.',
      );
    }

    const key = `${from.code}:${to.code}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const request = this.resolveRate(from, to);
    this.inFlight.set(key, request);

    try {
      return await request;
    } finally {
      if (this.inFlight.get(key) === request) {
        this.inFlight.delete(key);
      }
    }
  }

  private async resolveRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const cached = await this.readCache(from, to);

    if (cached && this.isFresh(cached, this.clock.now())) {
      return this.toExchangeRate(from, to, cached);
    }

    let snapshot: ExchangeRateSnapshot;
    try {
      snapshot = await this.apiClient.getRate(from, to);
    } catch (error) {
      const now = this.clock.now();
      const transient = isTransientFrankfurterFailure(error);

      this.logger.error(
        'expense_group.fx.upstream_request_failed',
        {
          base_currency: from.code,
          quote_currency: to.code,
          transient_failure: transient,
          failure_type: error instanceof Error ? error.name : 'unknown',
        },
        error,
      );

      if (transient && cached && this.canUseFallback(cached, now)) {
        this.logger.warn('expense_group.fx.stale_cache_fallback_used', {
          base_currency: from.code,
          quote_currency: to.code,
          quoted_at: cached.quotedAt.toISOString(),
          cache_age_ms: now.getTime() - cached.cachedAt.getTime(),
          max_fallback_age_ms: MAX_FALLBACK_AGE_MS,
        });

        return this.toExchangeRate(from, to, cached);
      }

      // Do not expose provider-specific errors or transport details to clients.
      // The cause remains available to structured logs and diagnostics.
      throw DomainErrors.unavailable(
        'expense_group.fx.rate_unavailable',
        `Exchange rate ${from.code}/${to.code} is currently unavailable.`,
        { from: from.code, to: to.code },
        error,
      );
    }

    const entry: CachedExchangeRate = {
      ...snapshot,
      cachedAt: this.clock.now(),
    };

    try {
      await this.cache.save(from.code, to.code, entry, MAX_FALLBACK_AGE_MS);
    } catch (error) {
      // Cache failure must not fail a quote that has already been fetched.
      this.logger.error(
        'expense_group.fx.cache.write_failed',
        { base_currency: from.code, quote_currency: to.code },
        error,
      );
    }

    return this.toExchangeRate(from, to, entry);
  }

  private async readCache(from: Currency, to: Currency): Promise<CachedExchangeRate | null> {
    try {
      return await this.cache.find(from.code, to.code);
    } catch (error) {
      // Redis is an optimization/fallback source, not a hard dependency for
      // obtaining a current quote from the authoritative provider.
      this.logger.error(
        'expense_group.fx.cache.read_failed',
        { base_currency: from.code, quote_currency: to.code },
        error,
      );
      return null;
    }
  }

  private toExchangeRate(from: Currency, to: Currency, entry: CachedExchangeRate): ExchangeRate {
    return ExchangeRate.create({
      from,
      to,
      numerator: entry.numerator,
      denominator: entry.denominator,
      provider: entry.provider,
      quotedAt: entry.quotedAt,
    });
  }

  private isFresh(entry: CachedExchangeRate, now: Date): boolean {
    const ageMs = now.getTime() - entry.cachedAt.getTime();
    return ageMs >= 0 && ageMs <= FRESH_CACHE_TTL_MS;
  }

  private canUseFallback(entry: CachedExchangeRate, now: Date): boolean {
    const ageMs = now.getTime() - entry.cachedAt.getTime();
    return ageMs >= 0 && ageMs <= MAX_FALLBACK_AGE_MS;
  }
}
