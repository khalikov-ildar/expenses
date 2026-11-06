import { Injectable, Logger } from '@nestjs/common';
import { RefreshToken, RefreshTokenId } from '../../domain/refresh-token.js';
import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { RefreshTokenRepository } from '@/modules/auth/identity/application/ports/refresh-token.repository.js';
import { TokenHasher } from '@/modules/auth/identity/application/ports/token-hasher.js';
import { TokenPair, TokenProvider } from '@/modules/auth/identity/application/ports/token-provider.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { authenticationFailedError, userNotFoundError } from '@/modules/auth/identity/domain/errors.js';
import { Clock } from '@/shared/domain/clock.js';
import { RefreshTokenPolicy } from '../../domain/refresh-token.policy.js';
import { AuthApplicationContext } from '@/shared/application/ports/application-context.js';
import { RefreshTokenFamily, RefreshTokenRevocationReasons } from '../../domain/refresh-token-family.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

interface GeneratedTokens {
  jti: RefreshTokenId;
  expiresAt: Date;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenHandler {
  constructor(
    private readonly clock: Clock,
    private readonly userRepo: AuthUserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly tokenProvider: TokenProvider,
    private readonly policy: RefreshTokenPolicy,
    private readonly context: AuthApplicationContext,
    private readonly transactionManager: TransactionManager,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(): Promise<RefreshTokenOutput> {
    let reuseDetected = false;
    let postCommitError: DomainError | undefined;

    try {
      const result = await this.transactionManager.run(async () => {
        const { jti, userId, familyId, refreshToken: providedRefreshToken } = this.context;

        if (!providedRefreshToken || !familyId) {
          throw authenticationFailedError();
        }

        const state = await this.refreshTokenRepo.findForUpdate(jti as RefreshTokenId, userId);
        if (!state) {
          throw authenticationFailedError();
        }

        const { token: currentToken, family } = state;

        if (family.id !== familyId) {
          throw authenticationFailedError();
        }

        const validation = this.policy.validateRefreshToken(currentToken, family);

        switch (validation.type) {
          case 'expired':
            throw validation.error;
          case 'reuse-detected':
            // Keep the transaction successful so the family revocation commits.
            // Throwing here would roll the revocation back with the transaction.
            reuseDetected = true;
            postCommitError = validation.error;
            await this.refreshTokenRepo.revokeFamily(family.id, RefreshTokenRevocationReasons.REUSE_DETECTED);
            return null;
          case 'family-revoked':
          case 'revoked':
            throw validation.error;
          case 'valid':
            break;
        }

        if (!this.tokenHasher.compare(providedRefreshToken, currentToken.token)) {
          throw authenticationFailedError();
        }

        await this.loadUser(userId);

        const newTokens = await this.generateNewTokens(userId, family);
        await this.persistTokenRotation(newTokens, currentToken);

        return {
          output: this.formOutput(newTokens),
          log: {
            userId,
            familyId: family.id,
            previousJti: currentToken.id,
            newJti: newTokens.jti,
            generation: currentToken.generation + 1,
          },
        };
      });

      if (postCommitError) {
        this.logger.warn('auth.refresh.reuse_detected', {
          user_id: this.context.userId,
          family_id: this.context.familyId,
          replayed_jti: this.context.jti,
        });
        throw postCommitError;
      }

      const committed = result as { output: RefreshTokenOutput; log: Record<string, unknown> };
      this.logger.info('auth.refresh.succeeded', committed.log);
      return committed.output;
    } catch (error) {
      if (!reuseDetected) {
        this.logger.warn('auth.refresh.failed', {
          user_id: this.context.userId,
          family_id: this.context.familyId,
          jti: this.context.jti,
          failure_code: error instanceof DomainError ? error.code : 'internal_error',
        });
      }
      throw error;
    }
  }

  private async loadUser(userId: IdentityId): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw userNotFoundError({ metadata: { id: userId } });
    }
  }

  private async generateNewTokens(userId: IdentityId, family: RefreshTokenFamily): Promise<GeneratedTokens> {
    const { accessJti, refreshJti } = this.tokenProvider.getJtiPair();
    const tokens = await this.tokenProvider.signTokenPair({
      sub: userId,
      accessJti,
      refreshJti,
      familyId: family.id,
    });

    const decoded = this.tokenProvider.decode(tokens.refreshToken);
    if (!decoded?.exp) {
      throw authenticationFailedError();
    }

    const tokenExpiresAt = new Date(decoded.exp * 1000);
    const expiresAt = tokenExpiresAt <= family.expiresAt ? tokenExpiresAt : family.expiresAt;

    return {
      ...tokens,
      jti: refreshJti,
      expiresAt,
    };
  }

  private async persistTokenRotation(newTokens: GeneratedTokens, oldToken: RefreshToken): Promise<void> {
    const refreshTokenEntity = RefreshToken.create(
      newTokens.jti,
      oldToken.familyId,
      this.tokenHasher.hashToken(newTokens.refreshToken),
      newTokens.expiresAt,
      oldToken.generation + 1,
      oldToken.id,
    );

    oldToken.rotate(this.clock.now(), refreshTokenEntity.id);
    await this.refreshTokenRepo.rotate(oldToken, refreshTokenEntity);
  }

  private formOutput(tokens: TokenPair): RefreshTokenOutput {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
