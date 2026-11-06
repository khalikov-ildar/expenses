import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { ExpireGroupInvitations } from '../../application/commands/expire-invitations.js';

/** Infrastructure scheduling adapter for the invitation-expiry use case. */
@Injectable()
export class ExpireGroupInvitationsScheduler {
  constructor(
    private readonly expireInvitations: ExpireGroupInvitations,
    private readonly logger: ApplicationLogger,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async handleCron(): Promise<void> {
    const expiredCount = await this.expireInvitations.execute(100);
    if (expiredCount > 0) {
      this.logger.info('expense_group.invitation.expire.batch_processed', { expired_count: expiredCount });
    }
  }
}
