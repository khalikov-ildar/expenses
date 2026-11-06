import { DomainEvent, DomainEventId } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';
import { GroupInvitationId } from '../group-invitation.js';

export const GroupInvitationExpiredType = 'group-invitation.expired' as const;
export type GroupInvitationExpiredType = typeof GroupInvitationExpiredType;

export class GroupInvitationExpiredEvent implements DomainEvent<GroupInvitationExpiredType, GroupInvitationId, {}> {
  readonly occuredAt: Date;
  constructor(
    readonly id: DomainEventId,
    readonly type: GroupInvitationExpiredType,
    readonly aggregateId: GroupInvitationId,
    readonly payload: {},
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
