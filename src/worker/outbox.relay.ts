import { CheckGroupForActivation } from '@/modules/expense-group/application/commands/check-group-for-activation.js';
import { ExpenseGroupRepository } from '@/modules/expense-group/application/ports/expense-group.repository.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const LIMIT = 30;
const BATCH_SIZE = 15;

@Injectable()
export class OutboxRelay {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly check: CheckGroupForActivation,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, {
    waitForCompletion: true,
  })
  async handleCron(): Promise<void> {
    const groups = await this.groupRepo.findCandidatesForActivation(LIMIT);

    for (let i = 0; i < groups.length; i += BATCH_SIZE) {
      const batch = groups.slice(i, i + BATCH_SIZE);

      // startRequest() only creates an ALS context and opens NO database
      // transaction. Use run() so lockById()'s FOR UPDATE actually locks
      // the row for the duration of the batch.
      await this.transactionManager.run(async () => {
        for (const group of batch) {
          await this.check.execute(group.id);
        }
      });
    }
  }
}
