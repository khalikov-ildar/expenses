import type { IdentityId } from '@/shared/domain/id/auth.js';
import type { DomainEvent, DomainEventId } from '@/shared/domain/aggregate.js';
import type { Clock } from '@/shared/domain/clock.js';
import type { ExpenseGroupId } from '../expense-group.js';
import type { GroupMemberId } from '../group-member.js';

export const GroupMemberLeftType = 'group-member.left' as const;
export type GroupMemberLeftType = typeof GroupMemberLeftType;

export interface GroupMemberLeftPayload {
  groupId: ExpenseGroupId;
  identityId: IdentityId;
}

export class GroupMemberLeftEvent
  implements DomainEvent<GroupMemberLeftType, GroupMemberId, GroupMemberLeftPayload>
{
  readonly occuredAt: Date;

  constructor(
    readonly id: DomainEventId,
    readonly type: GroupMemberLeftType,
    readonly aggregateId: GroupMemberId,
    readonly payload: GroupMemberLeftPayload,
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
