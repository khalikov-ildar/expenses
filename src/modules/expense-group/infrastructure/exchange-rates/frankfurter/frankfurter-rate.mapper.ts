import type { FrankfurterResponse } from './frankfurter-response.schema.js';

export interface ExchangeRateSnapshot {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly provider: 'frankfurter';
  readonly quotedAt: Date;
}

/** Converts Frankfurter's decimal rate into an exact rational representation. */
export function mapFrankfurterRate(data: FrankfurterResponse): ExchangeRateSnapshot {
  const { numerator, denominator } = decimalToRational(data.rate);

  return {
    numerator,
    denominator,
    provider: 'frankfurter',
    quotedAt: new Date(`${data.date}T00:00:00.000Z`),
  };
}

function decimalToRational(value: number): { numerator: bigint; denominator: bigint } {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Exchange rate must be a positive finite number.');
  }

  // Number#toString produces the shortest decimal that round-trips to this
  // finite JS number. Parsing that representation avoids floating-point math
  // in subsequent monetary conversions.
  const normalized = value.toString().toLowerCase();
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(normalized);

  if (!match) {
    throw new Error('Invalid decimal representation.');
  }

  const fraction = match[2] ?? '';
  const exponent = Number(match[3] ?? 0);

  let numerator = BigInt(match[1] + fraction);
  let denominator = 1n;
  const scale = fraction.length - exponent;

  if (scale > 0) {
    denominator = 10n ** BigInt(scale);
  } else if (scale < 0) {
    numerator *= 10n ** BigInt(-scale);
  }

  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;

  while (b !== 0n) {
    [a, b] = [b, a % b];
  }

  return a;
}
