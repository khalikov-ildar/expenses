import { DomainErrors } from '@/shared/domain/domain-error.js';
import { Currency, Money } from './currency.js';

/** Exact rational quote: numerator / denominator target major units per source major unit. */
export class ExchangeRate {
  private constructor(
    readonly from: Currency,
    readonly to: Currency,
    readonly numerator: bigint,
    readonly denominator: bigint,
    readonly provider: string,
    readonly quotedAt: Date,
  ) {}

  static create(input: {
    from: Currency;
    to: Currency;
    numerator: bigint;
    denominator: bigint;
    provider: string;
    quotedAt: Date;
  }): ExchangeRate {
    if (input.from.equals(input.to)) {
      throw DomainErrors.invalid('expense_group.fx.same_currency_quote', 'A quote is unnecessary for identical currencies.');
    }
    if (input.numerator <= 0n || input.denominator <= 0n || !input.provider.trim()) {
      throw DomainErrors.invalid('expense_group.fx.invalid_quote', 'Exchange-rate quote is invalid.');
    }
    if (!Number.isFinite(input.quotedAt.getTime())) {
      throw DomainErrors.invalid('expense_group.fx.invalid_quote_time', 'Exchange-rate quote timestamp is invalid.');
    }
    return new ExchangeRate(
      input.from,
      input.to,
      input.numerator,
      input.denominator,
      input.provider,
      new Date(input.quotedAt),
    );
  }

  convert(amount: Money): Money {
    if (!amount.currency.equals(this.from)) {
      throw DomainErrors.invalid('expense_group.fx.source_currency_mismatch', 'Exchange-rate source currency does not match the amount.');
    }

    // Convert source minor units -> target minor units, retaining exact integer arithmetic.
    const numerator =
      amount.minorUnits * this.numerator * 10n ** BigInt(this.to.minorUnitDigits);
    const denominator = this.denominator * 10n ** BigInt(this.from.minorUnitDigits);
    return Money.fromMinorUnits(roundHalfEven(numerator, denominator), this.to);
  }
}

function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const doubledRemainder = remainder * 2n;
  if (doubledRemainder < denominator) return quotient;
  if (doubledRemainder > denominator) return quotient + 1n;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}
