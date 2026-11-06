import { IdentityId } from '@/shared/domain/id/auth.js';
import { Brand, createIdFactory } from '@/shared/domain/id/index.js';

export type RefreshTokenFamilyId = Brand<string, 'RefreshTokenFamilyId'>;

export const RefreshTokenFamilyIdFactory = createIdFactory<RefreshTokenFamilyId>();

export const RefreshTokenRevocationReasons = {
  ROTATED: 'ROTATED',
  LOGOUT: 'LOGOUT',
  REUSE_DETECTED: 'REUSE_DETECTED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SECURITY_EVENT: 'SECURITY_EVENT',
} as const;

export type RefreshTokenRevocationReason =
  (typeof RefreshTokenRevocationReasons)[keyof typeof RefreshTokenRevocationReasons];

export interface RefreshTokenFamilyPersistence {
  id: RefreshTokenFamilyId;
  userId: IdentityId;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  revokedReason?: RefreshTokenRevocationReason | null;
}

export class RefreshTokenFamily {
  private constructor(
    public readonly id: RefreshTokenFamilyId,
    public readonly userId: IdentityId,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    public revokedAt: Date | null = null,
    public revokedReason: RefreshTokenRevocationReason | null = null,
  ) {}

  static create(id: RefreshTokenFamilyId, userId: IdentityId, createdAt: Date, expiresAt: Date): RefreshTokenFamily {
    if (expiresAt <= createdAt) {
      throw new Error('Refresh token family expiry must be after creation');
    }

    return new RefreshTokenFamily(id, userId, createdAt, expiresAt);
  }

  static fromPersistence(data: RefreshTokenFamilyPersistence): RefreshTokenFamily {
    return new RefreshTokenFamily(
      data.id,
      data.userId,
      data.createdAt,
      data.expiresAt,
      data.revokedAt ?? null,
      data.revokedReason ?? null,
    );
  }

  revoke(now: Date, reason: RefreshTokenRevocationReason): void {
    if (this.revokedAt) return;

    this.revokedAt = now;
    this.revokedReason = reason;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt <= now;
  }
}
