import { mapFrankfurterRate } from './frankfurter-rate.mapper.js';
import { frankfurterResponseSchema } from './frankfurter-response.schema.js';

describe('Frankfurter rate mapping', () => {
  test('maps decimal rates to reduced exact rational values', () => {
    const data = frankfurterResponseSchema.parse({
      date: '2026-11-03',
      base: 'USD',
      quote: 'EUR',
      rate: 0.9125,
    });

    expect(mapFrankfurterRate(data)).toEqual({
      numerator: 73n,
      denominator: 80n,
      provider: 'frankfurter',
      quotedAt: new Date('2026-11-03T00:00:00.000Z'),
    });
  });

  test.each([
    { date: '2026-02-30', base: 'USD', quote: 'EUR', rate: 1.2 },
    { date: '2026-11-03', base: 'US', quote: 'EUR', rate: 1.2 },
    { date: '2026-11-03', base: 'USD', quote: 'EUR', rate: 0 },
    { date: '2026-11-03', base: 'USD', quote: 'EUR', rate: Number.NaN },
  ])('rejects invalid Frankfurter payload %#', (payload) => {
    expect(frankfurterResponseSchema.safeParse(payload).success).toBe(false);
  });
});
