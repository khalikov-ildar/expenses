import { AuthenticationStrategyResolver } from '../strategies/authentication-strategy.resolver.js';
import { AuthenticationResult } from '../strategies/authentication.strategy.js';
import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { ExternalIdentityRepository } from '@/modules/auth/identity/application/ports/external-identity.repository.js';
import { TokenIssuer } from '@/modules/auth/identity/application/ports/token-issuer.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '@shared/application/ports/transaction-manager.js';
import {
  ExternalIdentity,
  ExternalIdentityIdFactory,
  OAuthProvider,
} from '@/modules/auth/identity/domain/external-identity.js';
import {
  oauthEmailNotVerifiedError,
  oauthIdentityAlreadyLinkedError,
  userNotFoundError,
} from '@/modules/auth/identity/domain/errors.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';

@Injectable()
export class LinkOAuthAccountHandler {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly strategyResolver: AuthenticationStrategyResolver,
    private readonly identityRepo: ExternalIdentityRepository,
    private readonly userRepo: AuthUserRepository,
    private readonly tokenIssuer: TokenIssuer,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: { provider: OAuthProvider; code: string; codeVerifier: string; userId: IdentityId }) {
    try {
      const strategy = this.strategyResolver.resolve(input.provider);
      const identity = await strategy.authenticate({
        code: input.code,
        codeVerifier: input.codeVerifier,
      });

      this.assertVerifiedEmail(identity);

      const tokenPair = await this.transactionManager.run(async () => {
        const actor = await this.userRepo.findById(input.userId);
        if (!actor) throw userNotFoundError({ metadata: { id: input.userId } });

        const existing = await this.identityRepo.find(identity.provider, identity.providerUserId);

        if (existing && existing.userId !== input.userId) {
          throw oauthIdentityAlreadyLinkedError();
        }

        if (!existing) {
          await this.identityRepo.save(
            new ExternalIdentity(
              ExternalIdentityIdFactory.random(),
              identity.provider,
              identity.providerUserId,
              input.userId,
            ),
          );
        }

        return this.tokenIssuer.issue(input.userId);
      });

      this.logger.info('auth.oauth.link.succeeded', { provider: input.provider, user_id: input.userId });
      return tokenPair;
    } catch (error) {
      this.logger.warn('auth.oauth.link.failed', {
        provider: input.provider,
        user_id: input.userId,
        failureCode: error instanceof DomainError ? error.code : 'internal_error',
      });
      throw error;
    }
  }

  private assertVerifiedEmail(identity: AuthenticationResult): void {
    if (!identity.emailVerified) {
      throw oauthEmailNotVerifiedError({ metadata: { provider: identity.provider } });
    }
  }
}
