import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { Currency } from '../../../domain/currency.js';
import { FrankfurterApiClient } from './frankfurter-api.client.js';
import { FrankfurterHttpError, FrankfurterProtocolError, FrankfurterTransportError } from './frankfurter.errors.js';

describe('FrankfurterApiClient', () => {
  const from = Currency.create('USD');
  const to = Currency.create('EUR');

  test('requests the v2 pair endpoint and maps the response', async () => {
    const http = {
      get: vitest.fn().mockReturnValue(
        of({
          data: { date: '2026-11-03', base: 'USD', quote: 'EUR', rate: 0.92 },
        }),
      ),
    };
    const client = new FrankfurterApiClient(http as any);

    await expect(client.getRate(from, to)).resolves.toMatchObject({
      numerator: 23n,
      denominator: 25n,
      provider: 'frankfurter',
    });
    expect(http.get).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/usd/eur',
      expect.objectContaining({ timeout: 5_000, headers: { Accept: 'application/json' } }),
    );
  });

  test('classifies upstream HTTP responses separately from network errors', async () => {
    const httpError = Object.assign(new Error('upstream failed'), {
      isAxiosError: true,
      response: { status: 503 },
    });
    const http = { get: vitest.fn().mockReturnValue(throwError(() => httpError)) };
    const client = new FrankfurterApiClient(http as any);

    await expect(client.getRate(from, to)).rejects.toBeInstanceOf(FrankfurterHttpError);
  });

  test('classifies transport errors', async () => {
    const http = { get: vitest.fn().mockReturnValue(throwError(() => new AxiosError('timeout', 'ETIMEDOUT'))) };
    const client = new FrankfurterApiClient(http as any);

    await expect(client.getRate(from, to)).rejects.toBeInstanceOf(FrankfurterTransportError);
  });

  test('rejects malformed response payloads as protocol errors', async () => {
    const http = { get: vitest.fn().mockReturnValue(of({ data: { base: 'USD' } })) };
    const client = new FrankfurterApiClient(http as any);

    await expect(client.getRate(from, to)).rejects.toBeInstanceOf(FrankfurterProtocolError);
  });

  test('rejects an unexpected currency pair returned by the upstream API', async () => {
    const http = {
      get: vitest.fn().mockReturnValue(
        of({ data: { date: '2026-11-03', base: 'USD', quote: 'GBP', rate: 0.78 } }),
      ),
    };
    const client = new FrankfurterApiClient(http as any);

    await expect(client.getRate(from, to)).rejects.toBeInstanceOf(FrankfurterProtocolError);
  });
});
