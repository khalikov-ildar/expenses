import { FrankfurterHttpError, FrankfurterTransportError, isTransientFrankfurterFailure } from './frankfurter.errors.js';

describe('Frankfurter failure classification', () => {
  test.each([408, 425, 429, 500, 502, 503, 504])('treats HTTP %s as transient', (status) => {
    expect(isTransientFrankfurterFailure(new FrankfurterHttpError(status))).toBe(true);
  });

  test.each([400, 401, 403, 404, 422])('does not treat HTTP %s as transient', (status) => {
    expect(isTransientFrankfurterFailure(new FrankfurterHttpError(status))).toBe(false);
  });

  test('treats transport failures as transient', () => {
    expect(isTransientFrankfurterFailure(new FrankfurterTransportError(new Error('ECONNRESET')))).toBe(true);
  });

  test('does not treat protocol errors or unknown errors as transient', () => {
    expect(isTransientFrankfurterFailure(new Error('invalid JSON'))).toBe(false);
    expect(isTransientFrankfurterFailure(null)).toBe(false);
  });
});
