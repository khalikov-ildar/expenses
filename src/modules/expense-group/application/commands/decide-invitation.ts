import { Clock } from '@shared/domain/clock.js';
import {
  GroupInvitationDecision,
  GroupInvitationIdFactory,
  GroupInvitationStatus,
} from '@expense-group/domain/group-invitation.js';
import { GroupMemberIdFactory, GroupMemberStatus } from '@expense-group/domain/group-member.js';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { ExpenseGroupStatus } from '../../domain/expense-group.js';

export class MakeDecisionOnInvitationCommand {
  constructor(
    public readonly invitationId: string,
    public readonly actorId: IdentityId,
    public readonly decision: GroupInvitationDecision,
  ) {}
}

@Injectable()
export class MakeDecisionOnInvitation {
  constructor(
    private invitationRepo: GroupInvitationRepository,
    private memberRepo: GroupMemberRepository,
    private groupRepo: ExpenseGroupRepository,
    private transactionManager: TransactionManager,
    private outboxRepo: OutboxRepository,
    private clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(cmd: MakeDecisionOnInvitationCommand) {
    return executeWithLogging(
      this.logger,
      'expense_group.invitation.decide',
      { invitation_id: cmd.invitationId, actor_id: cmd.actorId, decision: cmd.decision },
      async () => {
        await this.transactionManager.run(async () => {
          const invitationRef = await this.invitationRepo.getById(GroupInvitationIdFactory.create(cmd.invitationId));
          await this.groupRepo.lockById(invitationRef.groupId);
          const invitation = await this.invitationRepo.getById(invitationRef.id);
          const group = await this.groupRepo.getById(invitation.groupId);
          if (group.status !== ExpenseGroupStatus.PENDING) {
            throw DomainErrors.conflict(
              'expense_group.group.not_pending',
              'Invitations cannot be accepted or rejected because the group is not pending.',
              { groupId: invitation.groupId },
            );
          }
          const invitee = await this.memberRepo.getById(invitation.inviteeId);
          if (invitee.identityId !== cmd.actorId) {
            throw DomainErrors.forbidden(
              'expense_group.invitation.forbidden_actor',
              'Only the invited user can decide this invitation.',
              { invitationId: invitation.id, actorId: cmd.actorId },
            );
          }
          invitation.decide(cmd.decision, invitation.inviteeId, this.clock);
          invitee.decideInvitation(cmd.decision, this.clock);
          const invitationUpdated = await this.invitationRepo.saveStatusChange(
            invitation,
            GroupInvitationStatus.PENDING,
          );

          if (!invitationUpdated) {
            throw DomainErrors.conflict(
              'expense_group.invitation.concurrent_modification',
              'The invitation was modified concurrently.',
              { invitationId: invitation.id },
            );
          }

          const memberUpdated = await this.memberRepo.saveStatusChange(invitee, GroupMemberStatus.INVITED);

          if (!memberUpdated) {
            throw DomainErrors.conflict(
              'expense_group.member.concurrent_modification',
              'The group membership was modified concurrently.',
              { groupMemberId: invitee.id },
            );
          }

          await this.outboxRepo.saveEvents([invitation]);
        });
      },
    );
  }
}
