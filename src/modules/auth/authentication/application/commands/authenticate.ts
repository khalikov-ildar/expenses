import { AuthenticationStrategyResolver } from '../strategies/authentication-strategy.resolver.js';
import { AuthenticationResult } from '../strategies/authentication.strategy.js';
import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { ExternalIdentityRepository } from '@/modules/auth/identity/application/ports/external-identity.repository.js';
import { TokenIssuer } from '@/modules/auth/identity/application/ports/token-issuer.js';
import { AuthUser } from '@/modules/auth/identity/domain/auth-user.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Clock } from '@/shared/domain/clock.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@shared/application/ports/transaction-manager.js';
import {
  OAuthProvider,
  ExternalIdentity,
  ExternalIdentityIdFactory,
} from '@/modules/auth/identity/domain/external-identity.js';
import {
  oauthAccountLinkRequiredError,
  oauthEmailNotVerifiedError,
  userNotFoundError,
} from '@/modules/auth/identity/domain/errors.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';

@Injectable()
export class AuthenticateUserHandler {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly strategyResolver: AuthenticationStrategyResolver,
    private readonly identityRepo: ExternalIdentityRepository,
    private readonly userRepo: AuthUserRepository,
    private readonly tokenIssuer: TokenIssuer,
    private readonly clock: Clock,
    private readonly logger: ApplicationLogger,
    private readonly outboxRepo: OutboxRepository,
  ) {}

  async execute(provider: OAuthProvider, input: { code: string; codeVerifier: string }) {
    // Provider HTTP calls must not hold a database transaction open.
    try {
      const strategy = this.strategyResolver.resolve(provider);
      const identity = await strategy.authenticate(input);

      if (!identity.emailVerified) {
        throw oauthEmailNotVerifiedError({ metadata: { provider } });
      }
      const { userId, tokenPair } = await this.transactionManager.run(async () => {
        const user = await this.resolveUser(identity);
        return { userId: user.id, tokenPair: await this.tokenIssuer.issue(user.id) };
      });

      this.logger.info('auth.oauth.login.succeeded', { provider, user_id: userId });

      return tokenPair;
    } catch (error) {
      // Was: 'auth.oauth.loggin.succeeded' on the failure path, which both
      // misspelled the event and reported failures as successes in logs/alerting.
      this.logger.warn('auth.oauth.login.failed', {
        provider,
        failureCode: error instanceof DomainError ? error.code : 'internal_error',
      });
      throw error;
    }
  }

  private async resolveUser(identity: AuthenticationResult): Promise<AuthUser> {
    const existing = await this.identityRepo.find(identity.provider, identity.providerUserId);

    if (existing) {
      const user = await this.userRepo.findById(existing.userId);
      if (!user) throw userNotFoundError({ metadata: { id: AuthUserIdFactory.create(existing.userId) } });
      return user;
    }

    const existingUserByEmail = await this.userRepo.findByEmail(identity.email);

    // OAuth login never silently merges with an existing local account.
    if (existingUserByEmail) {
      throw oauthAccountLinkRequiredError();
    }

    const user = AuthUser.register(
      AuthUserIdFactory.random(),
      identity.email,
      null,
      identity.name ?? null,
      identity.emailVerified ? this.clock.now() : null,
      this.clock,
    );
    await this.userRepo.save(user);
    await this.identityRepo.save(
      new ExternalIdentity(ExternalIdentityIdFactory.random(), identity.provider, identity.providerUserId, user.id),
    );
    await this.outboxRepo.saveEvents([user]);

    return user;
  }
}
