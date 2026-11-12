import { Currency, Money } from './currency.js';

describe('Currency', () => {
  test('normalizes the code and exposes the currency minor-unit precision', () => {
    const currency = Currency.create(' usd ');

    expect(currency.code).toBe('USD');
    expect(currency.minorUnitDigits).toBe(2);
  });

  test.each([
    ['JPY', 0],
    ['USD', 2],
    ['KWD', 3],
  ])('uses the minor-unit precision defined for %s', (code, digits) => {
    expect(Currency.create(code).minorUnitDigits).toBe(digits);
  });

  test.each(['US', 'USDD', '', '12A'])('rejects malformed currency code %j', (code) => {
    expect(() => Currency.create(code)).toThrow();
  });
});

describe('Money', () => {
  test.each([
    ['12', 'USD', 1_200n, '12.00'],
    ['12.3', 'USD', 1_230n, '12.30'],
    ['12.34', 'USD', 1_234n, '12.34'],
    ['100', 'JPY', 100n, '100'],
    ['1.234', 'KWD', 1_234n, '1.234'],
  ])('converts %s %s to exact minor units and back', (amount, code, minorUnits, decimal) => {
    const money = Money.fromDecimal(amount, Currency.create(code));

    expect(money.minorUnits).toBe(minorUnits);
    expect(money.toDecimalString()).toBe(decimal);
  });

  test.each(['0', '0.00', '-1', '-0.01', '+1', '01.00', '1e2', '1,000'])(
    'rejects non-positive or malformed decimal amount %j',
    (amount) => {
      expect(() => Money.fromDecimal(amount, Currency.create('USD'))).toThrow();
    },
  );

  test('rejects fractional precision that the currency cannot represent', () => {
    expect(() => Money.fromDecimal('1.001', Currency.create('USD'))).toThrow();
  });

  test('does not allow a non-positive minor-unit amount to be rehydrated', () => {
    expect(() => Money.fromMinorUnits(0n, Currency.create('USD'))).toThrow();
    expect(() => Money.fromMinorUnits(-1n, Currency.create('USD'))).toThrow();
  });

  test('compares currencies by normalized ISO code', () => {
    expect(Currency.create('usd').equals(Currency.create('USD'))).toBe(true);
    expect(Currency.create('USD').equals(Currency.create('EUR'))).toBe(false);
  });
});
