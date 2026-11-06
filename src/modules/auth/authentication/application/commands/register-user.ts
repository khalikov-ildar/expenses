import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { PasswordHasher } from '@/modules/auth/identity/application/ports/password-hasher.js';
import { EmailVerificationService } from '@/modules/auth/identity/application/services/email-verification.service.js';
import { AuthUser } from '@/modules/auth/identity/domain/auth-user.js';
import { userAlreadyExistsError } from '@/modules/auth/identity/domain/errors.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { Clock } from '@/shared/domain/clock.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';

export interface RegisterCommand {
  email: string;
  name: string;
  password: string;
}

export interface RegisterOutput {
  id: IdentityId;
  email: string;
  name: string;
}

@Injectable()
export class RegisterUserHandler {
  constructor(
    private userRepo: AuthUserRepository,
    private passwordHasher: PasswordHasher,
    private transactionManager: TransactionManager,
    private clock: Clock,
    private outboxRepo: OutboxRepository,
    private emailVerification: EmailVerificationService,
    private logger: ApplicationLogger,
  ) {}

  async execute(cmd: RegisterCommand): Promise<RegisterOutput> {
    const passwordHash = await this.passwordHasher.hash(cmd.password);
    const user = AuthUser.register(AuthUserIdFactory.random(), cmd.email, passwordHash, cmd.name, null, this.clock);

    try {
      await this.transactionManager.run(async () => {
        // Existence check now runs INSIDE the transaction. Previously it ran
        // before it, so two concurrent registrations for the same email both
        // passed the check and the loser got an opaque 500 from the unique
        // constraint instead of a clean 409.
        const existing = await this.userRepo.findByEmail(cmd.email);
        if (existing) {
          throw userAlreadyExistsError({ metadata: { email: cmd.email } });
        }
        await this.userRepo.save(user);
        await this.outboxRepo.saveEvents([user]);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw userAlreadyExistsError({ metadata: { email: cmd.email } });
      }
      throw error;
    }

    // A registered user cannot log in until the email is verified, yet no
    // verification email was ever sent at registration time. Delivery
    // failure must not roll back the registration; the user can re-request.
    try {
      await this.emailVerification.issueAndSend(user);
    } catch {
      this.logger.warn('auth.registration.verification_email_failed', {
        userId: user.id,
        failureCode: 'email_delivery_failed',
      });
    }

    return this.formOutput(user);
  }

  private formOutput(user: AuthUser): RegisterOutput {
    return {
      id: user.id,
      email: user.email,
      name: user.name!,
    };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002'
  );
}
