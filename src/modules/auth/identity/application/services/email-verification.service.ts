import { AuthUser } from '../../domain/auth-user.js';
import { emailVerificationTokenInvalidError, userNotFoundError } from '../../domain/errors.js';
import { AuthUserRepository } from '../ports/auth-user.repository.js';
import { EmailVerificationTokenRepository } from '../ports/email-verification-token-repository.js';
import { EmailVerificationSender } from '../ports/email-verification.sender.js';
import { EmailVerificationSettings } from '../ports/email-verification.settings.js';
import { EmailVerificationTokenGenerator } from '../ports/email-verification.token-generator.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { Clock } from '@/shared/domain/clock.js';
import { Brand, createIdFactory } from '@/shared/domain/id/index.js';
import { Injectable } from '@nestjs/common';

export type EmailVerificationTokenId = Brand<string, 'EmailVerificationTokenId'>;
export const EmailVerificationTokenIdFactory = createIdFactory<EmailVerificationTokenId>();

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly userRepo: AuthUserRepository,
    private readonly tokenRepo: EmailVerificationTokenRepository,
    private readonly tokenGenerator: EmailVerificationTokenGenerator,
    private readonly sender: EmailVerificationSender,
    private readonly transactionManager: TransactionManager,
    private readonly clock: Clock,
    private readonly settings: EmailVerificationSettings,
    private readonly logger: ApplicationLogger,
  ) {}

  async requestForEmail(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || user.isEmailVerified()) return;
    await this.issueAndSend(user);
  }

  async issueAndSend(user: AuthUser): Promise<void> {
    const generated = this.tokenGenerator.generate();
    const now = this.clock.now();
    const expiresAt = this.clock.after(+this.settings.ttlMs);

    await this.transactionManager.run(async () => {
      await this.tokenRepo.revokeActiveForUser(user.id, now);
      await this.tokenRepo.create({
        id: EmailVerificationTokenIdFactory.random(),
        userId: user.id,
        tokenHash: generated.tokenHash,
        expiresAt,
      });
    });

    try {
      await this.sender.send({
        userId: user.id,
        to: user.email,
        name: user.name,
        verificationToken: generated.token,
      });
      this.logger.info('auth.email_verification.sent', { userId: user.id });
    } catch {
      this.logger.warn('auth.email_verification.delivery_failed', {
        userId: user.id,
        failureCode: 'email_delivery_failed',
      });
    }
  }

  async verify(token: string): Promise<void> {
    const tokenHash = this.tokenGenerator.hash(token);

    const verifiedAt = this.clock.now();
    let consumedUserId: string | undefined;

    await this.transactionManager.run(async () => {
      const consumed = await this.tokenRepo.consumeValid(tokenHash, verifiedAt);
      if (!consumed) throw emailVerificationTokenInvalidError();
      consumedUserId = consumed.userId;

      const user = await this.userRepo.findById(consumed.userId);
      if (!user) throw userNotFoundError({ metadata: { id: consumed.userId } });

      user.markEmailVerified(this.clock);
      await this.userRepo.update(user);
    });

    this.logger.info('auth.email_verification.verified', { userId: consumedUserId! });
  }
}
