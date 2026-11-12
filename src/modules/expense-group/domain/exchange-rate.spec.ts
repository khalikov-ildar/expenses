import { Currency, Money } from './currency.js';
import { ExchangeRate } from './exchange-rate.js';

describe('ExchangeRate', () => {
  const usd = Currency.create('USD');
  const eur = Currency.create('EUR');
  const quotedAt = new Date('2026-11-03T00:00:00.000Z');

  test('converts using the exact rational quote without floating-point arithmetic', () => {
    const rate = ExchangeRate.create({
      from: usd,
      to: eur,
      numerator: 91n,
      denominator: 100n,
      provider: 'test-provider',
      quotedAt,
    });

    expect(rate.convert(Money.fromDecimal('10.00', usd)).toDecimalString()).toBe('9.10');
  });

  test('rounds half minor units to the nearest even value', () => {
    const rate = ExchangeRate.create({
      from: usd,
      to: eur,
      numerator: 1n,
      denominator: 2n,
      provider: 'test-provider',
      quotedAt,
    });

    expect(rate.convert(Money.fromDecimal('0.03', usd)).minorUnits).toBe(2n);
    expect(rate.convert(Money.fromDecimal('0.05', usd)).minorUnits).toBe(2n);
  });

  test('accounts for different minor-unit precision between source and target currencies', () => {
    const jpy = Currency.create('JPY');
    const rate = ExchangeRate.create({
      from: jpy,
      to: usd,
      numerator: 1n,
      denominator: 100n,
      provider: 'test-provider',
      quotedAt,
    });

    expect(rate.convert(Money.fromDecimal('100', jpy)).toDecimalString()).toBe('1.00');
  });

  test('rejects conversion when the amount uses a different source currency', () => {
    const rate = ExchangeRate.create({
      from: usd,
      to: eur,
      numerator: 1n,
      denominator: 1n,
      provider: 'test-provider',
      quotedAt,
    });

    expect(() => rate.convert(Money.fromDecimal('1.00', eur))).toThrow();
  });

  test('rejects quotes for identical currencies', () => {
    expect(() =>
      ExchangeRate.create({
        from: usd,
        to: usd,
        numerator: 1n,
        denominator: 1n,
        provider: 'test-provider',
        quotedAt,
      }),
    ).toThrow();
  });

  test.each([
    { numerator: 0n, denominator: 1n, provider: 'provider' },
    { numerator: 1n, denominator: 0n, provider: 'provider' },
    { numerator: 1n, denominator: 1n, provider: '  ' },
  ])('rejects an invalid quote %#', ({ numerator, denominator, provider }) => {
    expect(() =>
      ExchangeRate.create({
        from: usd,
        to: eur,
        numerator,
        denominator,
        provider,
        quotedAt,
      }),
    ).toThrow();
  });

  test('rejects an invalid quote timestamp', () => {
    expect(() =>
      ExchangeRate.create({
        from: usd,
        to: eur,
        numerator: 1n,
        denominator: 1n,
        provider: 'test-provider',
        quotedAt: new Date(Number.NaN),
      }),
    ).toThrow();
  });
});
