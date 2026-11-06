import { Aggregate, DomainEventIdFactory } from '@/shared/domain/aggregate.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { AuthUserRegisteredEvent } from './events.js';
import { Clock } from '@/shared/domain/clock.js';
import { userHasNoPasswordError } from './errors.js';

interface UserCtor {
  id: IdentityId;
  email: string;
  passwordHash: string | null;
  name: string | null;
  emailVerifiedAt?: Date | null;
}

export type UserWithPassword = { passwordHash: string };

export class AuthUser extends Aggregate<IdentityId, AuthUserRegisteredEvent> {
  private constructor(
    id: IdentityId,
    public readonly email: string,
    public passwordHash: string | null,
    public readonly name: string | null,
    public emailVerifiedAt: Date | null,
  ) {
    super(id);
  }

  static register(
    id: IdentityId,
    email: string,
    passwordHash: string | null,
    name: string | null,
    emailVerifiedAt: Date | null,
    clock: Clock,
  ): AuthUser {
    const user = new AuthUser(id, email, passwordHash, name ?? null, emailVerifiedAt);
    user.addDomainEvent(
      new AuthUserRegisteredEvent(
        DomainEventIdFactory.random(),
        AuthUserRegisteredEvent.type,
        user.id,
        {
          email: user.email,
        },
        clock,
      ),
    );
    return user;
  }

  static fromPersistence(data: UserCtor): AuthUser {
    return new AuthUser(data.id, data.email, data.passwordHash, data.name, data.emailVerifiedAt ?? null);
  }

  changePassword(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
  }

  markEmailVerified(clock: Clock): void {
    if (!this.emailVerifiedAt) {
      this.emailVerifiedAt = clock.now();
    }
  }

  isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  assertPasswordExists(): asserts this is UserWithPassword {
    if (!this.passwordHash) {
      throw userHasNoPasswordError();
    }
  }
}
