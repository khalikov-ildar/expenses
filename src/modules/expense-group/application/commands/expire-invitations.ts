import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { GroupInvitationStatus } from '../../domain/group-invitation.js';
import { Clock } from '@/shared/domain/clock.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { GroupMemberStatus } from '../../domain/group-member.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { Aggregate, DomainEvent } from '@/shared/domain/aggregate.js';

@Injectable()
export class ExpireGroupInvitations {
  constructor(
    private transactionManager: TransactionManager,
    private invitationRepo: GroupInvitationRepository,
    private memberRepo: GroupMemberRepository,
    private outboxRepo: OutboxRepository,
    private clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(batchSize: number): Promise<number> {
    return executeWithLogging(this.logger, 'expense_group.invitation.expire', { batch_size: batchSize }, async () => {
      if (batchSize < 1 || batchSize > 1000) {
        return 0;
      }

      return this.transactionManager.run(async () => {
        const now = this.clock.now();
        const invitations = await this.invitationRepo.getExpiredCandidates(now, batchSize);
        if (invitations.length === 0) {
          return 0;
        }

        const invitees = await this.memberRepo.getByIds(invitations.map((invitation) => invitation.inviteeId));
        const inviteesById = new Map(invitees.map((invitee) => [invitee.id, invitee]));
        const aggregates: Aggregate<string, DomainEvent<string, string, unknown>>[] = [];

        for (const invitation of invitations) {
          const invitee = inviteesById.get(invitation.inviteeId);
          if (!invitee) {
            throw DomainErrors.notFound('expense_group.member.not_found', 'The invited group member does not exist.', {
              memberId: invitation.inviteeId,
            });
          }

          invitation.expire(this.clock);
          invitee.expireInvitation(this.clock);

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

          aggregates.push(invitation);
        }

        await this.outboxRepo.saveEvents(aggregates);
        return invitations.length;
      });
    });
  }
}
