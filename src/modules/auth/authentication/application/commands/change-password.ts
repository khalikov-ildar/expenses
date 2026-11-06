import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { PasswordHasher } from '@/modules/auth/identity/application/ports/password-hasher.js';
import { RefreshTokenRepository } from '@/modules/auth/identity/application/ports/refresh-token.repository.js';
import { AuthUser, UserWithPassword } from '@/modules/auth/identity/domain/auth-user.js';
import { passwordMismatchError, samePasswordError, userNotFoundError } from '@/modules/auth/identity/domain/errors.js';
import { RefreshTokenRevocationReasons } from '@/modules/auth/session/domain/refresh-token-family.js';
import { BaseApplicationContext } from '@/shared/application/ports/application-context.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';

export interface ChangePasswordCommand {
  oldPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordHandler {
  constructor(
    private readonly context: BaseApplicationContext,
    private readonly transactionManager: TransactionManager,
    private readonly userRepo: AuthUserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(cmd: ChangePasswordCommand): Promise<void> {
    const userId = this.context.userId;

    // Read and validate the user in the same transaction as the password update
    // and session revocation. This avoids validating a user snapshot fetched
    // before the transaction began.
    await this.transactionManager.run(async () => {
      const user: AuthUser = await this.loadUser(userId);
      user.assertPasswordExists();

      await this.verifyCurrentPassword(cmd.oldPassword, user);
      await this.ensurePasswordIsNotReused(cmd.newPassword, user);

      const newPasswordHash = await this.passwordHasher.hash(cmd.newPassword);
      user.changePassword(newPasswordHash);

      await this.userRepo.update(user);
      await this.refreshTokenRepo.revokeAllForUser(user.id, RefreshTokenRevocationReasons.PASSWORD_CHANGED);
    });
  }

  private async loadUser(userId: IdentityId): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw userNotFoundError({ metadata: { id: userId } });
    }
    return user;
  }

  private async verifyCurrentPassword(currentPassword: string, user: UserWithPassword): Promise<void> {
    if (!(await this.passwordHasher.compare(currentPassword, user.passwordHash))) {
      throw passwordMismatchError();
    }
  }

  private async ensurePasswordIsNotReused(newPassword: string, user: UserWithPassword): Promise<void> {
    if (await this.passwordHasher.compare(newPassword, user.passwordHash)) {
      throw samePasswordError();
    }
  }
}
