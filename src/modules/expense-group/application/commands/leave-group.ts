import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { ExpenseGroupId, ExpenseGroupIdFactory } from '../../domain/expense-group.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Clock } from '@/shared/domain/clock.js';
import { GroupMemberStatus } from '../../domain/group-member.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';

export class LeaveGroupCommand {
  constructor(
    public readonly groupId: string,
    public readonly actorId: IdentityId,
  ) {}
}

@Injectable()
export class LeaveGroup {
  constructor(
    private transactionManager: TransactionManager,
    private memberRepo: GroupMemberRepository,
    private groupRepo: ExpenseGroupRepository,
    private invitationRepo: GroupInvitationRepository,
    private outboxRepo: OutboxRepository,
    private clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(cmd: LeaveGroupCommand): Promise<void> {
    return executeWithLogging(
      this.logger,
      'expense_group.group.leave',
      { group_id: cmd.groupId, actor_id: cmd.actorId },
      async () => {
        const groupId = ExpenseGroupIdFactory.create(cmd.groupId);

        await this.transactionManager.run(async () => {
          await this.groupRepo.lockById(groupId);
          const member = await this.memberRepo.getActiveByGroupAndIdentity(groupId, cmd.actorId);

          member.leave(this.clock);
          const updated = await this.memberRepo.saveStatusChange(member, GroupMemberStatus.ACTIVE);

          if (!updated) {
            throw DomainErrors.conflict(
              'expense_group.member.concurrent_change',
              'The membership was changed by another operation.',
              { memberId: member.id },
            );
          }

          // Persist the membership transition and its event in the same DB transaction.
          await this.outboxRepo.saveEvents([member]);

          const activeCount = await this.memberRepo.countActiveByGroup(groupId);
          if (activeCount === 0) {
            const groupCancelled = await this.groupRepo.cancelIfCancellable(groupId);

            if (!groupCancelled) {
              throw DomainErrors.conflict(
                'expense_group.group.concurrent_change',
                'The group could not be cancelled because its status changed.',
                { groupId },
              );
            }
            await this.invitationRepo.cancelForGroup(groupId);
          }
        });
      },
    );
  }
}
