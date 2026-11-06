import { AuthenticateUserHandler } from './application/commands/authenticate.js';
import { ChangePasswordHandler } from './application/commands/change-password.js';
import { LoginCommandHandler } from './application/commands/login.js';
import { LogoutCommandHandler } from './application/commands/logout.js';
import { RegisterUserHandler } from './application/commands/register-user.js';
import { OAuthClientResolver } from './application/services/oauth-client.resolver.js';
import { AuthenticationStrategyResolver } from './application/strategies/authentication-strategy.resolver.js';
import { GithubOAuthStrategy } from './application/strategies/github.oauth-strategy.js';
import { GoogleOAuthStrategy } from './application/strategies/google.oauth-strategy.js';
import { PasswordAuthenticationStrategy } from './application/strategies/password.auth-strategy.js';
import { DefaultOAuthClientResolver } from './infrastructure/client/default.oauth-client.resolver.js';
import { DefaultOAuthStrategyResolver } from './infrastructure/default.oauth-strategy.resolver.js';
import { GithubOAuthClient } from './infrastructure/client/github.oauth-client.js';
import { GoogleOAuthClient } from './infrastructure/client/google.oauth-client.js';
import { AuthenticationController } from './presentation/authentication.controller.js';
import { IdentityModule } from '../identity/identity.module.js';
import { HttpModule } from '@nestjs/axios';
import { Module, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { OAuthTransactionRepository } from './application/oauth/oauth-transaction.repository.js';
import { PrismaOAuthTransactionRepository } from './infrastructure/persistence/prisma.oauth-transaction.repository.js';
import { OAuthTransactionService } from './application/services/oauth-transaction.service.js';
import { LinkOAuthAccountHandler } from './application/commands/link-oauth-account.js';
import { RequestEmailVerificationHandler } from './application/commands/request-email-verification.js';
import { VerifyEmailHandler } from './application/commands/verify-email.js';

const resolvers: Provider[] = [
  { provide: AuthenticationStrategyResolver, useClass: DefaultOAuthStrategyResolver },
  { provide: OAuthClientResolver, useClass: DefaultOAuthClientResolver },
  { provide: OAuthTransactionRepository, useClass: PrismaOAuthTransactionRepository },
  OAuthTransactionService,
];

const strategies: Provider[] = [GoogleOAuthStrategy, GithubOAuthStrategy, PasswordAuthenticationStrategy];
const clients: Provider[] = [GoogleOAuthClient, GithubOAuthClient];
const commandHandlers: Provider[] = [
  AuthenticateUserHandler,
  LoginCommandHandler,
  LogoutCommandHandler,
  RegisterUserHandler,
  ChangePasswordHandler,
  RequestEmailVerificationHandler,
  VerifyEmailHandler,
  LinkOAuthAccountHandler,
];
const providers = [...resolvers, ...strategies, ...clients, ...commandHandlers];

@Module({
  imports: [IdentityModule, DiscoveryModule, HttpModule],
  providers,
  controllers: [AuthenticationController],
})
export class AuthenticationModule {}
