import { RefreshTokenRepository } from '@/modules/auth/identity/application/ports/refresh-token.repository.js';
import { RefreshTokenRevocationReasons } from '@/modules/auth/session/domain/refresh-token-family.js';
import { RefreshTokenId } from '@/modules/auth/session/domain/refresh-token.js';
import { AuthApplicationContext } from '@/shared/application/ports/application-context.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LogoutCommandHandler {
  constructor(
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly context: AuthApplicationContext,
    private readonly transactionManager: TransactionManager,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(): Promise<void> {
    try {
      const revokedFamilyId = await this.transactionManager.run(async () => {
        const { jti, userId, familyId } = this.context;

        if (!familyId) {
          this.logger.warn('auth.logout.family_missing', {
            userId,
            jti,
          });
          return;
        }

        const state = await this.refreshTokenRepo.findForUpdate(jti as RefreshTokenId, userId);
        if (!state || state.family.id !== familyId) {
          this.logger.info('auth.logout.family_absent', {
            user_id: userId,
            family_id: familyId,
          });
          return;
        }

        await this.refreshTokenRepo.revokeFamily(state.family.id, RefreshTokenRevocationReasons.LOGOUT);
        return state.family.id;
      });

      if (revokedFamilyId) {
        this.logger.info('auth.logout.succeeded', { user_id: this.context.userId, family_id: revokedFamilyId });
      }
    } catch (error) {
      this.logger.error(
        'auth.logout.failed',
        {
          userId: this.context.userId,
          familyId: this.context.familyId,
          failureCode: error instanceof DomainError ? error.code : 'internal_error',
        },
        error,
      );
      throw error;
    }
  }
}
