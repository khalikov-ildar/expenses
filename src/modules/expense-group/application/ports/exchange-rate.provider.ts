import { Currency } from '../../domain/currency.js';
import { ExchangeRate } from '../../domain/exchange-rate.js';

/** Returns an exact quote for one source major unit expressed in target major units. */
export abstract class ExchangeRateProvider {
  abstract getRate(from: Currency, to: Currency): Promise<ExchangeRate>;
}
