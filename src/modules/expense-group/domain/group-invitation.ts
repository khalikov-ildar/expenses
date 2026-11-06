import { ExpenseGroupId } from './expense-group.js';
import { GroupMemberId } from './group-member.js';
import { Aggregate, DomainEventIdFactory } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';
import { DomainErrors } from '@shared/domain/domain-error.js';
import { Brand, createIdFactory } from '@shared/domain/id/index.js';
import {
  GroupInvitationAcceptedEvent,
  GroupInvitationAcceptedType,
  GroupInvitationCreatedEvent,
  GroupInvitationCreatedType,
  GroupInvitationDomainEvent,
  GroupInvitationRejectedEvent,
  GroupInvitationRejectedType,
  GroupInvitationExpiredEvent,
  GroupInvitationExpiredType,
} from './events/index.js';

export type GroupInvitationId = Brand<string, 'GroupInvitationId'>;
export const GroupInvitationIdFactory = createIdFactory<GroupInvitationId>();
export type GroupInvitationDecision = typeof GroupInvitationStatus.ACCEPTED | typeof GroupInvitationStatus.REJECTED;

export const GroupInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type GroupInvitationStatus = keyof typeof GroupInvitationStatus;

export interface CreateGroupInvitationPayload {
  id: GroupInvitationId;
  inviterId: GroupMemberId;
  inviteeId: GroupMemberId;
  groupId: ExpenseGroupId;
  expiresAt: Date;
}

export interface RehydrateGroupInvitationPayload {
  id: GroupInvitationId;
  inviterId: GroupMemberId;
  inviteeId: GroupMemberId;
  groupId: ExpenseGroupId;
  expiresAt: Date;
  status: GroupInvitationStatus;
}

export class GroupInvitation extends Aggregate<GroupInvitationId, GroupInvitationDomainEvent> {
  private constructor(
    id: GroupInvitationId,
    private readonly _inviterId: GroupMemberId,
    private readonly _inviteeId: GroupMemberId,
    private readonly _groupId: ExpenseGroupId,
    private readonly _expiresAt: Date,
    private _status: GroupInvitationStatus,
  ) {
    super(id);
  }

  static create(
    { id, inviterId, inviteeId, groupId, expiresAt }: CreateGroupInvitationPayload,
    clock: Clock,
  ): GroupInvitation {
    const invitation = new GroupInvitation(id, inviterId, inviteeId, groupId, expiresAt, GroupInvitationStatus.PENDING);
    invitation.addDomainEvent(
      new GroupInvitationCreatedEvent(
        DomainEventIdFactory.random(),
        GroupInvitationCreatedType,
        invitation.id,
        {},
        clock,
      ),
    );
    return invitation;
  }

  static rehydrate({
    id,
    inviterId,
    inviteeId,
    expiresAt,
    groupId,
    status,
  }: RehydrateGroupInvitationPayload): GroupInvitation {
    return new GroupInvitation(id, inviterId, inviteeId, groupId, expiresAt, status);
  }

  decide(decision: GroupInvitationDecision, by: GroupMemberId, clock: Clock): void {
    if (!this.isPending()) {
      throw DomainErrors.conflict('expense_group.invitation.not_pending', 'The invitation is no longer pending.', {
        invitationId: this.id,
      });
    }
    if (this.isExpired(clock)) {
      throw DomainErrors.conflict('expense_group.invitation.expired', 'The invitation has expired.', {
        invitationId: this.id,
      });
    }
    if (this._inviteeId !== by) {
      throw DomainErrors.forbidden(
        'expense_group.invitation.forbidden_member',
        'Only the invited member can decide the invitation.',
        {
          invitationId: this.id,
          memberId: by,
        },
      );
    }
    this._status = decision;
    if (decision === GroupInvitationStatus.ACCEPTED) {
      this.addDomainEvent(
        new GroupInvitationAcceptedEvent(
          DomainEventIdFactory.random(),
          GroupInvitationAcceptedType,
          this.id,
          {},
          clock,
        ),
      );
      return;
    }
    this.addDomainEvent(
      new GroupInvitationRejectedEvent(DomainEventIdFactory.random(), GroupInvitationRejectedType, this.id, {}, clock),
    );
  }

  expire(clock: Clock): void {
    if (!this.isPending()) {
      throw DomainErrors.conflict('expense_group.invitation.not_pending', 'The invitation is no longer pending.', {
        invitationId: this.id,
      });
    }
    this._status = GroupInvitationStatus.EXPIRED;
    this.addDomainEvent(
      new GroupInvitationExpiredEvent(
        DomainEventIdFactory.random(),
        GroupInvitationExpiredType,
        this.id,
        {},
        clock,
      ),
    );
  }

  get inviterId() {
    return this._inviterId;
  }
  get groupId() {
    return this._groupId;
  }
  get inviteeId() {
    return this._inviteeId;
  }
  get status() {
    return this._status;
  }
  get expiresAt() {
    return this._expiresAt;
  }

  private isExpired(clock: Clock): boolean {
    return this.expiresAt <= clock.now();
  }

  private isPending(): boolean {
    return this._status === GroupInvitationStatus.PENDING;
  }
}
