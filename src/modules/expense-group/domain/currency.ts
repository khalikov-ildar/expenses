import { DomainErrors } from '@/shared/domain/domain-error.js';
import { z } from 'zod';

/** ISO-4217-style currency code with the minor-unit precision supplied by Intl. */
export class Currency {
  private constructor(
    readonly code: string,
    readonly minorUnitDigits: number,
  ) {}

  static create(code: string): Currency {
    const normalized = code.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw DomainErrors.invalid('expense_group.currency.invalid', 'Currency must be a three-letter code.', {
        currency: code,
      });
    }

    if (!z.currencyCode().safeParse(normalized).success) {
      throw DomainErrors.invalid('expense_group.currency.unsupported', 'The currency code is not supported.', {
        currency: normalized,
      });
    }

    try {
      const digits = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: normalized,
      }).resolvedOptions().maximumFractionDigits as number;
      return new Currency(normalized, digits);
    } catch {
      throw DomainErrors.invalid('expense_group.currency.unsupported', 'The currency code is not supported.', {
        currency: normalized,
      });
    }
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}

export class Money {
  private constructor(
    readonly minorUnits: bigint,
    readonly currency: Currency,
  ) {}

  static fromDecimal(value: string, currency: Currency): Money {
    const normalized = value.trim();
    const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(normalized);
    if (!match) {
      throw DomainErrors.invalid('expense_group.money.invalid_amount', 'Amount must be a positive decimal string.', {
        amount: value,
      });
    }

    const fraction = match[2] ?? '';
    if (fraction.length > currency.minorUnitDigits) {
      throw DomainErrors.invalid(
        'expense_group.money.excess_precision',
        `Amount has more than ${currency.minorUnitDigits} decimal places for ${currency.code}.`,
        { amount: value, currency: currency.code, allowedFractionDigits: currency.minorUnitDigits },
      );
    }

    const scale = 10n ** BigInt(currency.minorUnitDigits);
    const whole = BigInt(match[1]);
    const fractional = fraction.length === 0 ? 0n : BigInt(fraction.padEnd(currency.minorUnitDigits, '0'));
    const minorUnits = whole * scale + fractional;
    if (minorUnits <= 0n) {
      throw DomainErrors.invalid('expense_group.money.must_be_positive', 'Expense amount must be greater than zero.');
    }
    return new Money(minorUnits, currency);
  }

  static fromMinorUnits(minorUnits: bigint, currency: Currency): Money {
    if (minorUnits <= 0n) {
      throw DomainErrors.invalid('expense_group.money.must_be_positive', 'Money amount must be greater than zero.');
    }
    return new Money(minorUnits, currency);
  }

  toDecimalString(): string {
    const digits = this.currency.minorUnitDigits;
    const scale = 10n ** BigInt(digits);
    const whole = this.minorUnits / scale;
    if (digits === 0) return whole.toString();
    const fraction = (this.minorUnits % scale).toString().padStart(digits, '0');
    return `${whole}.${fraction}`;
  }
}
