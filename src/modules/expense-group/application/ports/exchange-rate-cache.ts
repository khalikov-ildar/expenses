/**
 * A provider quote persisted for reuse and temporary outage fallback.
 * Rates are stored as exact rational values to preserve the domain's integer
 * arithmetic when converting monetary amounts.
 */
export interface CachedExchangeRate {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly provider: string;
  readonly quotedAt: Date;
  readonly cachedAt: Date;
}

/** Cache port used by exchange-rate providers. The implementation owns storage details. */
export abstract class ExchangeRateCache {
  abstract find(baseCode: string, quoteCode: string): Promise<CachedExchangeRate | null>;

  /**
   * Persist the quote for the requested retention period. `ttlMs` is a storage
   * retention period, not the freshness policy used by the provider.
   */
  abstract save(
    baseCode: string,
    quoteCode: string,
    entry: CachedExchangeRate,
    ttlMs: number,
  ): Promise<void>;
}
