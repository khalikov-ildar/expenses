import { AppConfig } from '@/shared/infrastructure/config/env.schema.js';
import { AuthUserRepository } from './application/ports/auth-user.repository.js';
import { EmailVerificationTokenRepository } from './application/ports/email-verification-token-repository.js';
import { EmailVerificationSettings } from './application/ports/email-verification.settings.js';
import { EmailVerificationTokenGenerator } from './application/ports/email-verification.token-generator.js';
import { ExternalIdentityRepository } from './application/ports/external-identity.repository.js';
import { PasswordHasher } from './application/ports/password-hasher.js';
import { RefreshTokenRepository } from './application/ports/refresh-token.repository.js';
import { RequestIntegrityService } from './application/ports/request-integrity.service.js';
import { TokenHasher } from './application/ports/token-hasher.js';
import { TokenIssuer } from './application/ports/token-issuer.js';
import { TokenProvider } from './application/ports/token-provider.js';
import { PrismaAuthUserRepository } from './infrastructure/persistence/prisma.auth-user.repository.js';
import { PrismaEmailVerificationTokenRepository } from './infrastructure/persistence/prisma.email-verification-token.repository.js';
import { PrismaExternalIdentityRepository } from './infrastructure/persistence/prisma.external-identity.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma.refresh-token.repository.js';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt.password-hasher.js';
import { CookieIntegrityStorage } from './infrastructure/security/cookie.integrity.storage.js';
import { DefaultRequestIntegrityService } from './infrastructure/security/default.request-integrity.service.js';
import { HmacSha256TokenHasher } from './infrastructure/security/hmac.token-hasher.js';
import { JwtTokenIssuer } from './infrastructure/security/jwt.token-issuer.js';
import { JwtTokenProvider } from './infrastructure/security/jwt.token-provider.js';
import { RandomEmailVerificationTokenGenerator } from './infrastructure/security/random.email-verification-token-generator.js';
import { RequestIntegrityStorage } from './infrastructure/security/request-integrity.storage.js';
import { AuthHttpService } from './presentation/auth.http.service.js';
import { JwtGuard } from './presentation/guards/jwt.guard.js';
import { SecurityGuard } from './presentation/guards/security.guard.js';
import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerificationSender } from './application/ports/email-verification.sender.js';
import { EmailVerificationService } from './application/services/email-verification.service.js';
import { ResendEmailVerificationSender } from './infrastructure/mailing/resend.email-verification-sender.js';

const repositories: Provider[] = [
  { provide: AuthUserRepository, useClass: PrismaAuthUserRepository },
  { provide: EmailVerificationTokenRepository, useClass: PrismaEmailVerificationTokenRepository },
  { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
  { provide: ExternalIdentityRepository, useClass: PrismaExternalIdentityRepository },
];

const guards = [JwtGuard, SecurityGuard];

const providers: Provider[] = [
  { provide: TokenProvider, useClass: JwtTokenProvider },
  { provide: PasswordHasher, useClass: BcryptPasswordHasher },
  { provide: TokenHasher, useClass: HmacSha256TokenHasher },
  { provide: TokenIssuer, useClass: JwtTokenIssuer },
  { provide: EmailVerificationTokenGenerator, useClass: RandomEmailVerificationTokenGenerator },
  {
    provide: EmailVerificationSettings,
    inject: [AppConfig],
    useFactory: (cfg: AppConfig) => ({ ttlMs: cfg.emailVerificationTtl }),
  },
  { provide: EmailVerificationSender, useClass: ResendEmailVerificationSender },
  EmailVerificationService,
  { provide: RequestIntegrityStorage, useClass: CookieIntegrityStorage },
  { provide: RequestIntegrityService, useClass: DefaultRequestIntegrityService },
  AuthHttpService,
  ...guards,
  ...repositories,
];

@Module({
  imports: [JwtModule.register({})],
  providers: [...providers, { provide: APP_GUARD, useClass: SecurityGuard }],
  exports: [...providers, JwtModule],
})
export class IdentityModule {}
