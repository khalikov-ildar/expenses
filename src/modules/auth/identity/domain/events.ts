import { IdentityId } from '@/shared/domain/id/auth.js';
import { DomainEvent, DomainEventId } from '@shared/domain/aggregate.js';
import { Clock } from '@shared/domain/clock.js';

export const AuthUserRegisteredEventType = 'auth-user.registered' as const;
export type AuthUserRegisteredEventType = typeof AuthUserRegisteredEventType;

export class AuthUserRegisteredEvent implements DomainEvent<AuthUserRegisteredEventType, IdentityId, {}> {
  static readonly type = AuthUserRegisteredEventType;
  readonly occuredAt: Date;
  constructor(
    readonly id: DomainEventId,
    readonly type: AuthUserRegisteredEventType,
    readonly aggregateId: IdentityId,
    readonly payload: {
      email: string;
    },
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
