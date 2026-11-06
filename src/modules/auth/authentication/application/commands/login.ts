import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationStrategyResolver } from '../strategies/authentication-strategy.resolver.js';
import { TokenIssuer } from '@/modules/auth/identity/application/ports/token-issuer.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { AuthKinds } from '@/modules/auth/identity/domain/external-identity.js';
import { DomainError } from '@/shared/domain/domain-error.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginOutput {
  userId: IdentityId;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class LoginCommandHandler {
  constructor(
    private strategyResolver: AuthenticationStrategyResolver,
    private tokenIssuer: TokenIssuer,
    private transactionManager: TransactionManager,
    private logger: ApplicationLogger,
  ) {}

  async execute(cmd: LoginCommand): Promise<LoginOutput> {
    return this.transactionManager.run(async () => {
      try {
        const passwordStrategy = this.strategyResolver.resolve(AuthKinds.password);
        const { providerUserId } = await passwordStrategy.authenticate(cmd);
        const userId = AuthUserIdFactory.create(providerUserId);
        const { accessToken, refreshToken } = await this.tokenIssuer.issue(userId);
        this.logger.info('auth.login.succeeded', {
          user_id: userId,
          authMethod: 'password',
        });
        return { userId, accessToken, refreshToken };
      } catch (error) {
        this.logger.warn('auth.login.failed', {
          authMethod: 'password',
          failureCode: error instanceof DomainError ? error.code : 'internal_error',
        });
        throw error;
      }
    });
  }
}
