import { DomainEvent, DomainEventId } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';
import { GroupInvitationId } from '../group-invitation.js';

export const GroupInvitationRejectedType = 'group-invitation.rejected' as const;
export type GroupInvitationRejectedType = typeof GroupInvitationRejectedType;

export class GroupInvitationRejectedEvent implements DomainEvent<GroupInvitationRejectedType, GroupInvitationId, {}> {
  readonly occuredAt: Date;
  constructor(
    readonly id: DomainEventId,
    readonly type: GroupInvitationRejectedType,
    readonly aggregateId: GroupInvitationId,
    readonly payload: {},
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
