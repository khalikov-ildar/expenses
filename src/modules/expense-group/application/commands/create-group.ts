import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { Clock } from '@shared/domain/clock.js';
import { TransactionManager } from '@shared/application/ports/transaction-manager.js';
import { ExpenseGroup, ExpenseGroupId, ExpenseGroupIdFactory } from '@expense-group/domain/expense-group.js';
import { GroupInvitation, GroupInvitationIdFactory } from '@expense-group/domain/group-invitation.js';
import { ExpenseGroupMember, GroupMemberIdFactory } from '@expense-group/domain/group-member.js';
import { OutboxRepository } from '@shared/application/ports/outbox.repository.js';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { Currency } from '../../domain/currency.js';

const GROUP_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class CreateExpenseGroupCommand {
  constructor(
    public readonly groupName: string,
    public readonly baseCurrency: string,
    public readonly inviteeIds: IdentityId[],
    public readonly inviterId: IdentityId,
  ) {}
}

export interface CreateExpenseGroupResponse {
  id: ExpenseGroupId;
  name: string;
  baseCurrency: string;
}

@Injectable()
export class CreateExpenseGroup {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly groupMemberRepo: GroupMemberRepository,
    private readonly invitationRepo: GroupInvitationRepository,
    private readonly outboxRepo: OutboxRepository,
    private readonly clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(cmd: CreateExpenseGroupCommand): Promise<CreateExpenseGroupResponse> {
    return executeWithLogging(this.logger, 'expense_group.group.create', { actor_id: cmd.inviterId }, async () => {
      const uniqueInviteeIds = new Set(cmd.inviteeIds);
      if (uniqueInviteeIds.size !== cmd.inviteeIds.length || uniqueInviteeIds.has(cmd.inviterId)) {
        throw DomainErrors.conflict(
          'expense_group.invitee_ids_must_be_unique_or_not_include_creator',
          'Invitees must be unique and must not include the group creator.',
        );
      }

      const currency = Currency.create(cmd.baseCurrency);
      const now = this.clock.now();
      const groupId = ExpenseGroupIdFactory.random();
      const creatorId = GroupMemberIdFactory.random();
      const group = ExpenseGroup.create(groupId, cmd.groupName, cmd.inviterId, currency);
      const creator = ExpenseGroupMember.createActive(creatorId, cmd.inviterId, groupId, now);
      const invitedMembers = cmd.inviteeIds.map((identityId) =>
        ExpenseGroupMember.createInvited(GroupMemberIdFactory.random(), identityId, groupId),
      );
      const expiresAt = new Date(now.getTime() + GROUP_INVITATION_TTL_MS);
      const invitations = invitedMembers.map((invitee) =>
        GroupInvitation.create(
          {
            id: GroupInvitationIdFactory.random(),
            inviterId: creator.id,
            inviteeId: invitee.id,
            groupId,
            expiresAt,
          },
          this.clock,
        ),
      );

      await this.transactionManager.run(async () => {
        await this.groupRepo.save(group);
        await this.groupMemberRepo.saveMany([creator, ...invitedMembers]);
        await this.invitationRepo.saveMany(invitations);
        await this.outboxRepo.saveEvents(invitations);
      });

      return { id: groupId, name: cmd.groupName, baseCurrency: currency.code };
    });
  }
}
