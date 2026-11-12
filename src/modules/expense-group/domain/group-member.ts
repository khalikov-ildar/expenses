import { IdentityId } from '@/shared/domain/id/auth.js';
import { Brand, createIdFactory } from '@shared/domain/id/index.js';
import { ExpenseGroupId } from './expense-group.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { GroupInvitationDecision, GroupInvitationStatus } from './group-invitation.js';
import { Clock } from '@/shared/domain/clock.js';
import { Aggregate, DomainEventIdFactory } from '@/shared/domain/aggregate.js';
import { GroupMemberLeftEvent, GroupMemberLeftType } from './events/group-member.left.js';

type GroupMemberDomainEvent = GroupMemberLeftEvent;

export type GroupMemberId = Brand<string, 'GroupMemberId'>;
export const GroupMemberIdFactory = createIdFactory<GroupMemberId>();
export const GroupMemberStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  LEFT: 'LEFT',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;

export type GroupMemberStatus = (typeof GroupMemberStatus)[keyof typeof GroupMemberStatus];

interface RehydrateGroupMemberPayload {
  id: GroupMemberId;
  identityId: IdentityId;
  groupId: ExpenseGroupId;
  status: GroupMemberStatus;
  joinedAt: Date | null;
  endedAt: Date | null;
}

export class ExpenseGroupMember extends Aggregate<GroupMemberId, GroupMemberDomainEvent> {
  private constructor(
    id: GroupMemberId,
    private readonly _identityId: IdentityId,
    private readonly _groupId: ExpenseGroupId,
    private _status: GroupMemberStatus,
    private _joinedAt: Date | null,
    private _endedAt: Date | null,
  ) {
    super(id);
  }

  static createInvited(id: GroupMemberId, identityId: IdentityId, groupId: ExpenseGroupId): ExpenseGroupMember {
    return new ExpenseGroupMember(id, identityId, groupId, GroupMemberStatus.INVITED, null, null);
  }

  static createActive(
    id: GroupMemberId,
    identityId: IdentityId,
    groupId: ExpenseGroupId,
    joinedAt: Date,
  ): ExpenseGroupMember {
    return new ExpenseGroupMember(id, identityId, groupId, GroupMemberStatus.ACTIVE, joinedAt, null);
  }

  static rehydrate(data: RehydrateGroupMemberPayload): ExpenseGroupMember {
    return new ExpenseGroupMember(data.id, data.identityId, data.groupId, data.status, data.joinedAt, data.endedAt);
  }

  decideInvitation(decision: GroupInvitationDecision, clock: Clock): void {
    this.assertStatus(GroupMemberStatus.INVITED, 'decide an invitation');

    const now = clock.now();

    if (decision === GroupInvitationStatus.ACCEPTED) {
      this._status = GroupMemberStatus.ACTIVE;
      this._joinedAt = now;
      this._endedAt = null;
      return;
    }
    this._status = GroupMemberStatus.DECLINED;
    this._endedAt = now;
  }

  leave(clock: Clock): void {
    this.assertStatus(GroupMemberStatus.ACTIVE, 'leave a group');
    this._status = GroupMemberStatus.LEFT;
    this._endedAt = clock.now();
    this.addDomainEvent(
      new GroupMemberLeftEvent(
        DomainEventIdFactory.random(),
        GroupMemberLeftType,
        this.id,
        { groupId: this.groupId, identityId: this.identityId },
        clock,
      ),
    );
  }

  expireInvitation(clock: Clock): void {
    this.assertStatus(GroupMemberStatus.INVITED, 'expire an invitation');
    this._status = GroupMemberStatus.EXPIRED;
    this._endedAt = clock.now();
  }

  private assertStatus(expected: GroupMemberStatus, action: string): void {
    if (this._status !== expected) {
      throw DomainErrors.conflict(
        'expense_group.member.invalid_transition',
        `Cannot ${action} when the membership status is ${this._status}.`,
        {
          memberId: this.id,
          currentStatus: this._status,
          expectedStatus: expected,
        },
      );
    }
  }

  get identityId(): IdentityId {
    return this._identityId;
  }

  get groupId(): ExpenseGroupId {
    return this._groupId;
  }

  get status(): GroupMemberStatus {
    return this._status;
  }

  get joinedAt(): Date | null {
    return this._joinedAt;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }
}
