import { AuthStrategy } from './authentication-strategy.decorator.js';
import { AuthenticationResult, AuthenticationStrategy } from './authentication.strategy.js';
import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { PasswordHasher } from '@/modules/auth/identity/application/ports/password-hasher.js';
import { authenticationFailedError, emailNotVerifiedError } from '@/modules/auth/identity/domain/errors.js';
import { AuthKinds } from '@/modules/auth/identity/domain/external-identity.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Injectable } from '@nestjs/common';

@Injectable()
@AuthStrategy(AuthKinds.password)
export class PasswordAuthenticationStrategy implements AuthenticationStrategy<typeof AuthKinds.password> {
  readonly provider = AuthKinds.password;
  constructor(
    private userRepo: AuthUserRepository,
    private passwordHasher: PasswordHasher,
    private logger: ApplicationLogger,
  ) {}

  async authenticate(input: { email: string; password: string }): Promise<AuthenticationResult> {
    const user = await this.userRepo.findByEmail(input.email);
    const ok = await this.passwordHasher.compare(input.password, user?.passwordHash ?? this.passwordHasher.dummyHash);
    if (!ok || !user) throw authenticationFailedError();
    if (!user.isEmailVerified()) {
      throw emailNotVerifiedError();
    }
    return {
      provider: this.provider,
      email: user.email,
      emailVerified: true,
      providerUserId: user.id,
      name: user.name,
    };
  }
}
