import { Injectable } from '@nestjs/common';
import type { ClaimedOutboxEvent } from '@/shared/application/ports/outbox.repository.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { GroupInvitationIdFactory } from '../../domain/group-invitation.js';
import { GroupMemberIdFactory } from '../../domain/group-member.js';
import { ExpenseIdFactory } from '../../domain/expense.js';
import { ExpenseRepository } from '../ports/expense.repository.js';
import { RealtimeNotificationPublisher } from '../ports/realtime-notification.publisher.js';
import type { RealtimeNotification } from '../ports/realtime-notification.publisher.js';

@Injectable()
export class GroupRealtimeNotificationHandler {
  constructor(
    private readonly invitationRepo: GroupInvitationRepository,
    private readonly memberRepo: GroupMemberRepository,
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly notifications: RealtimeNotificationPublisher,
    private readonly logger: ApplicationLogger,
  ) {}

  async created(event: ClaimedOutboxEvent): Promise<void> {
    const { invitation, inviter, invitee, group } = await this.loadContext(event.aggregateId);
    this.notifications.notifyUser(invitee.identityId, {
      id: event.id,
      type: 'group.invitation.created',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        invitationId: invitation.id,
        groupId: group.id,
        groupName: group.name,
        invitedBy: inviter.identityId,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
    this.logger.info('notifications.invitation.created', {
      invitation_id: invitation.id,
      recipient_id: invitee.identityId,
    });
  }

  async accepted(event: ClaimedOutboxEvent): Promise<void> {
    const { invitation, inviter, invitee, group } = await this.loadContext(event.aggregateId);

    this.notifications.notifyUser(inviter.identityId, {
      id: event.id,
      type: 'group.invitation.accepted',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        invitationId: invitation.id,
        groupId: group.id,
        groupName: group.name,
        decidedBy: invitee.identityId,
      },
    });

    // Acceptance changes the invited membership to ACTIVE. Let the other
    // active members know who joined, de-duplicating users with multiple
    // memberships/sessions in the same group.
    const recipients = new Set(
      (await this.memberRepo.getActiveByGroupId(invitation.groupId))
        .filter((member) => member.id !== invitee.id && member.identityId !== inviter.identityId)
        .map((member) => member.identityId),
    );
    const joinedNotification: RealtimeNotification = {
      id: event.id,
      type: 'group.member.joined',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        groupId: group.id,
        groupName: group.name,
        memberId: invitee.id,
        userId: invitee.identityId,
      },
    };
    for (const recipientId of recipients) {
      this.notifications.notifyUser(recipientId, joinedNotification);
    }

    this.logger.info('notifications.invitation.accepted', {
      invitation_id: invitation.id,
      inviter_id: inviter.identityId,
      invitee_id: invitee.identityId,
      member_notification_recipient_count: recipients.size,
    });
  }

  async rejected(event: ClaimedOutboxEvent): Promise<void> {
    await this.notifyInviterOfDecision(event, 'rejected');
  }

  async expired(event: ClaimedOutboxEvent): Promise<void> {
    const { invitation, inviter, invitee, group } = await this.loadContext(event.aggregateId);
    const notification: RealtimeNotification = {
      id: event.id,
      type: 'group.invitation.expired',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        invitationId: invitation.id,
        groupId: group.id,
        groupName: group.name,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };

    this.notifications.notifyUser(inviter.identityId, notification);
    this.notifications.notifyUser(invitee.identityId, notification);
    this.logger.info('notifications.invitation.expired', {
      invitation_id: invitation.id,
      inviter_id: inviter.identityId,
      invitee_id: invitee.identityId,
    });
  }

  async memberLeft(event: ClaimedOutboxEvent): Promise<void> {
    const member = await this.memberRepo.getById(GroupMemberIdFactory.create(event.aggregateId));
    const group = await this.groupRepo.getById(member.groupId);
    const recipients = new Set(
      (await this.memberRepo.getActiveByGroupId(member.groupId))
        .filter((activeMember) => activeMember.identityId !== member.identityId)
        .map((activeMember) => activeMember.identityId),
    );
    const notification: RealtimeNotification = {
      id: event.id,
      type: 'group.member.left',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        groupId: group.id,
        groupName: group.name,
        memberId: member.id,
        userId: member.identityId,
      },
    };

    for (const recipientId of recipients) {
      this.notifications.notifyUser(recipientId, notification);
    }

    this.logger.info('notifications.member.left', {
      group_id: group.id,
      member_id: member.id,
      user_id: member.identityId,
      recipient_count: recipients.size,
    });
  }

  async expenseCreated(event: ClaimedOutboxEvent): Promise<void> {
    const expense = await this.expenseRepo.getById(ExpenseIdFactory.create(event.aggregateId));
    const [group, members, activeMembers] = await Promise.all([
      this.groupRepo.getById(expense.groupId),
      this.memberRepo.getByIds([expense.createdByMemberId, expense.paidByMemberId]),
      this.memberRepo.getActiveByGroupId(expense.groupId),
    ]);

    const creator = members.find((member) => member.id === expense.createdByMemberId);
    const payer = members.find((member) => member.id === expense.paidByMemberId);
    if (!creator || !payer) {
      throw new Error(`Expense ${expense.id} is missing its creator or payer membership`);
    }

    const notification: RealtimeNotification = {
      id: event.id,
      type: 'group.expense.created',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        expenseId: expense.id,
        groupId: group.id,
        groupName: group.name,
        description: expense.description,
        amount: expense.originalAmount.toDecimalString(),
        currency: expense.originalAmount.currency.code,
        baseAmount: expense.baseAmount.toDecimalString(),
        baseCurrency: expense.baseAmount.currency.code,
        createdBy: creator.identityId,
        paidBy: payer.identityId,
      },
    };

    // Notify every active member except the actor who just created the expense.
    // De-duplicate by identity because the same user may have multiple sockets.
    const recipients = new Set(
      activeMembers
        .filter((member) => member.id !== expense.createdByMemberId)
        .map((member) => member.identityId),
    );
    for (const recipientId of recipients) {
      this.notifications.notifyUser(recipientId, notification);
    }

    this.logger.info('notifications.expense.created', {
      expense_id: expense.id,
      group_id: group.id,
      recipient_count: recipients.size,
    });
  }

  private async notifyInviterOfDecision(
    event: ClaimedOutboxEvent,
    decision: 'rejected',
  ): Promise<void> {
    const { invitation, invitee, inviter, group } = await this.loadContext(event.aggregateId);
    this.notifications.notifyUser(inviter.identityId, {
      id: event.id,
      type: 'group.invitation.rejected',
      occurredAt: event.occurredAt.toISOString(),
      data: {
        invitationId: invitation.id,
        groupId: group.id,
        groupName: group.name,
        decidedBy: invitee.identityId,
      },
    });
    this.logger.info(`notifications.invitation.${decision}`, {
      invitation_id: invitation.id,
      recipient_id: inviter.identityId,
      invitee_id: invitee.identityId,
    });
  }

  private async loadContext(invitationId: string) {
    const invitation = await this.invitationRepo.getById(GroupInvitationIdFactory.create(invitationId));
    const [members, group] = await Promise.all([
      this.memberRepo.getByIds([invitation.inviterId, invitation.inviteeId]),
      this.groupRepo.getById(invitation.groupId),
    ]);
    const inviter = members.find((member) => member.id === invitation.inviterId);
    const invitee = members.find((member) => member.id === invitation.inviteeId);

    // Fail the BullMQ job so the outbox event is retried rather than silently
    // dropping a notification when its related records cannot be resolved.
    if (!inviter || !invitee) {
      throw new Error(`Invitation ${invitationId} is missing one or more group members`);
    }

    return { invitation, inviter, invitee, group };
  }
}
