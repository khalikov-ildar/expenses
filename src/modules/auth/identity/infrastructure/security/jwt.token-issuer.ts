import { RefreshTokenFamily, RefreshTokenFamilyIdFactory } from '@/modules/auth/session/domain/refresh-token-family.js';
import { RefreshTokenRepository } from '../../application/ports/refresh-token.repository.js';
import { TokenHasher } from '../../application/ports/token-hasher.js';
import { TokenIssuer } from '../../application/ports/token-issuer.js';
import { TokenProvider } from '../../application/ports/token-provider.js';
import { RefreshToken } from '@/modules/auth/session/domain/refresh-token.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';
import { Clock } from '@/shared/domain/clock.js';
import { RefreshTokenConfig } from '@/shared/infrastructure/config/env.schema.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly tokenProvider: TokenProvider,
    private readonly tokenHasher: TokenHasher,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly clock: Clock,
    private readonly cfg: RefreshTokenConfig,
    private readonly transactionManager: TransactionManager,
  ) {}

  async issue(userId: IdentityId) {
    return this.transactionManager.run(async () => {
      const familyId = RefreshTokenFamilyIdFactory.random();
      const createdAt = this.clock.now();
      const familyExpiresAt = this.clock.after(this.cfg.refreshFamilyTtl);
      const family = RefreshTokenFamily.create(familyId, userId, createdAt, familyExpiresAt);

      const { accessJti, refreshJti } = this.tokenProvider.getJtiPair();
      const tokens = await this.tokenProvider.signTokenPair({
        sub: userId,
        accessJti,
        refreshJti,
        familyId,
      });

      const decoded = this.tokenProvider.decode(tokens.refreshToken);
      if (!decoded?.exp) {
        throw new Error('Refresh token did not contain an expiration');
      }

      const tokenExpiresAt = this.clock.fromMs(decoded.exp * 1000);
      const refreshExpiresAt = tokenExpiresAt <= familyExpiresAt ? tokenExpiresAt : familyExpiresAt;

      const refreshToken = RefreshToken.create(
        refreshJti,
        familyId,
        this.tokenHasher.hashToken(tokens.refreshToken),
        refreshExpiresAt,
        0,
        null,
      );

      await this.refreshTokenRepo.createFamily(family, refreshToken);

      return tokens;
    });
  }
}
