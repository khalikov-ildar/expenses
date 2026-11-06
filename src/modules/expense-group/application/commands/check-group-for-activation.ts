import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { ExpenseGroupId, ExpenseGroupStatus } from '../../domain/expense-group.js';

/**
 * Activates a group once all of its invitations have been resolved.
 *
 * The PENDING -> ACTIVE transition is expressed as a conditional UPDATE
 * (expectedStatus = PENDING), so concurrent workers / instances can never
 * double-activate a group. The row lock serializes checks against writers
 * of invitations and members for the same group.
 *
 * Previously this command ran OUTSIDE any transaction (OutboxRelay only
 * called startRequest, which opens no DB transaction), so the FOR UPDATE
 * lock in lockById was a no-op in autocommit mode.
 */
@Injectable()
export class CheckGroupForActivation {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(groupId: ExpenseGroupId): Promise<boolean> {
    return executeWithLogging(
      this.logger,
      'expense_group.group.activate',
      { group_id: groupId },
      async () => {
        const activated = await this.transactionManager.run(async () => {
          await this.groupRepo.lockById(groupId);
          return this.groupRepo.changeStatus(groupId, ExpenseGroupStatus.ACTIVE, ExpenseGroupStatus.PENDING);
        });

        if (!activated) {
          this.logger.debug('expense_group.group.activate.skipped', { group_id: groupId });
        }

        return activated;
      },
    );
  }
}
