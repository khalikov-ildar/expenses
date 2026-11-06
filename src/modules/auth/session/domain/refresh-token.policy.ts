import { Clock } from '@/shared/domain/clock.js';
import { RefreshToken } from './refresh-token.js';
import {
  refreshTokenExpiredError,
  refreshTokenReuseDetectedError,
  refreshTokenRevokedError,
} from '../../identity/domain/errors.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { RefreshTokenFamily } from './refresh-token-family.js';

interface RefreshTokenFailValidationResult {
  type: 'expired' | 'reuse-detected' | 'revoked' | 'family-revoked';
  error: DomainError;
}

type RefreshTokenSuccessValidationResult = { type: 'valid' };

export type RefreshTokenValidationResult = RefreshTokenFailValidationResult | RefreshTokenSuccessValidationResult;

export class RefreshTokenPolicy {
  constructor(private readonly clock: Clock) {}

  validateRefreshToken(token: RefreshToken, family: RefreshTokenFamily): RefreshTokenValidationResult {
    const now = this.clock.now();

    if (family.isRevoked()) {
      return {
        type: 'family-revoked',
        error: refreshTokenRevokedError(),
      };
    }

    if (family.isExpired(now) || token.isExpired(now)) {
      return {
        type: 'expired',
        error: refreshTokenExpiredError(),
      };
    }

    if (token.isReplay()) {
      return {
        type: 'reuse-detected',
        error: refreshTokenReuseDetectedError(),
      };
    }

    if (token.revoked) {
      return {
        type: 'revoked',
        error: refreshTokenRevokedError(),
      };
    }

    return { type: 'valid' };
  }
}
