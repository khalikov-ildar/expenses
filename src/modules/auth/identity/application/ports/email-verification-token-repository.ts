import { IdentityId } from '@/shared/domain/id/auth.js';

export interface CreatedEmailVerificationToken {
  id: string;
  userId: IdentityId;
  tokenHash: string;
  expiresAt: Date;
}

export interface ConsumedEmailVerificationToken {
  id: string;
  userId: IdentityId;
  expiresAt: Date;
}

export abstract class EmailVerificationTokenRepository {
  abstract revokeActiveForUser(userId: IdentityId, now: Date): Promise<void>;
  abstract create(input: CreatedEmailVerificationToken): Promise<void>;
  /** Atomically consumes a non-expired token exactly once. */
  abstract consumeValid(tokenHash: string, now: Date): Promise<ConsumedEmailVerificationToken | null>;
}
