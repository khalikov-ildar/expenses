import { DomainEvent, DomainEventId } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';
import { GroupInvitationId } from '../group-invitation.js';

export const GroupInvitationAcceptedType = 'group-invitation.accepted' as const;
export type GroupInvitationAcceptedType = typeof GroupInvitationAcceptedType;

export class GroupInvitationAcceptedEvent implements DomainEvent<GroupInvitationAcceptedType, GroupInvitationId, {}> {
  readonly occuredAt: Date;
  constructor(
    readonly id: DomainEventId,
    readonly type: GroupInvitationAcceptedType,
    readonly aggregateId: GroupInvitationId,
    readonly payload: {},
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
