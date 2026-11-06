import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import { lastValueFrom } from 'rxjs';
import { Currency } from '../../../domain/currency.js';
import { mapFrankfurterRate } from './frankfurter-rate.mapper.js';
import type { ExchangeRateSnapshot } from './frankfurter-rate.mapper.js';
import { frankfurterResponseSchema } from './frankfurter-response.schema.js';
import { FrankfurterHttpError, FrankfurterProtocolError, FrankfurterTransportError } from './frankfurter.errors.js';

const API_URL = 'https://api.frankfurter.dev';
const REQUEST_TIMEOUT_MS = 5_000;

/** HTTP adapter for the Frankfurter v2 single-pair rate endpoint. */
@Injectable()
export class FrankfurterApiClient {
  constructor(private readonly http: HttpService) {}

  async getRate(from: Currency, to: Currency): Promise<ExchangeRateSnapshot> {
    const url = `${API_URL}/v2/rate/${from.code.toLowerCase()}/${to.code.toLowerCase()}`;

    let payload: unknown;
    try {
      const response: AxiosResponse<unknown> = await lastValueFrom(
        this.http.get<unknown>(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { Accept: 'application/json' },
        }),
      );
      payload = response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        throw new FrankfurterHttpError(error.response.status, error);
      }

      throw new FrankfurterTransportError(error);
    }

    const parsed = frankfurterResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new FrankfurterProtocolError('Frankfurter returned an invalid response.', parsed.error);
    }

    const data = parsed.data;
    if (data.base.toUpperCase() !== from.code || data.quote.toUpperCase() !== to.code) {
      throw new FrankfurterProtocolError('Frankfurter returned an unexpected currency pair.');
    }

    return mapFrankfurterRate(data);
  }
}
