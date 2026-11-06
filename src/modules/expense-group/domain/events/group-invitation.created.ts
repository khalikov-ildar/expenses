import { DomainEvent, DomainEventId } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';
import { GroupInvitationId } from '../group-invitation.js';

export const GroupInvitationCreatedType = 'group-invitation.created' as const;
export type GroupInvitationCreatedType = typeof GroupInvitationCreatedType;

export class GroupInvitationCreatedEvent implements DomainEvent<GroupInvitationCreatedType, GroupInvitationId, {}> {
  readonly occuredAt: Date;
  constructor(
    readonly id: DomainEventId,
    readonly type: GroupInvitationCreatedType,
    readonly aggregateId: GroupInvitationId,
    readonly payload: {},
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
