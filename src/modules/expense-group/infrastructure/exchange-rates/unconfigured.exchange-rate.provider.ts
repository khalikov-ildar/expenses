import { Injectable } from '@nestjs/common';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { Currency } from '../../domain/currency.js';
import { ExchangeRate } from '../../domain/exchange-rate.js';
import { ExchangeRateProvider } from '../../application/ports/exchange-rate.provider.js';

/** Fail-closed default. Replace this provider with an adapter for your chosen FX source. */
@Injectable()
export class UnconfiguredExchangeRateProvider implements ExchangeRateProvider {
  async getRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    throw DomainErrors.invalid('expense_group.fx.provider_not_configured', 'No exchange-rate provider has been configured.', {
      from: from.code,
      to: to.code,
    });
  }
}
