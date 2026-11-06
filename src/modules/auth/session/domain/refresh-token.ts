import { Brand, createIdFactory } from '@shared/domain/id/index.js';
import {
  RefreshTokenFamilyId,
  RefreshTokenRevocationReason,
  RefreshTokenRevocationReasons,
} from './refresh-token-family.js';
import { refreshTokenRevokedError } from '../../identity/domain/errors.js';

export type RefreshTokenId = Brand<string, 'RefreshTokenId'>;
export const RefreshTokenIdFactory = createIdFactory<RefreshTokenId>();

export interface RefreshTokenPersistence {
  id: RefreshTokenId;
  familyId: RefreshTokenFamilyId;
  token: string;
  expiresAt: Date;
  generation: number;
  parentId?: RefreshTokenId | null;
  replacedById?: RefreshTokenId | null;
  revoked: boolean;
  revokedAt?: Date | null;
  revokedReason?: RefreshTokenRevocationReason | null;
}

export class RefreshToken {
  private constructor(
    public readonly id: RefreshTokenId,
    public readonly familyId: RefreshTokenFamilyId,
    public readonly token: string,
    public readonly expiresAt: Date,
    public readonly generation: number,
    public readonly parentId: RefreshTokenId | null = null,
    public replacedById: RefreshTokenId | null = null,
    public revoked = false,
    public revokedAt: Date | null = null,
    public revokedReason: RefreshTokenRevocationReason | null = null,
  ) {}

  static create(
    id: RefreshTokenId,
    familyId: RefreshTokenFamilyId,
    tokenHash: string,
    expiresAt: Date,
    generation = 0,
    parentId: RefreshTokenId | null = null,
  ): RefreshToken {
    return new RefreshToken(id, familyId, tokenHash, expiresAt, generation, parentId);
  }

  static fromPersistence(data: RefreshTokenPersistence): RefreshToken {
    return new RefreshToken(
      data.id,
      data.familyId,
      data.token,
      data.expiresAt,
      data.generation,
      data.parentId ?? null,
      data.replacedById ?? null,
      data.revoked,
      data.revokedAt ?? null,
      data.revokedReason ?? null,
    );
  }

  rotate(now: Date, replacementId: RefreshTokenId): void {
    if (this.revoked) {
      throw new Error('Refresh token is already revoked');
    }

    this.revoked = true;
    this.revokedAt = now;
    this.revokedReason = RefreshTokenRevocationReasons.ROTATED;
    this.replacedById = replacementId;
  }

  revoke(now: Date, reason: RefreshTokenRevocationReason): void {
    if (this.revoked) return;

    this.revoked = true;
    this.revokedAt = now;
    this.revokedReason = reason;
  }

  isRevoked(): boolean {
    return this.revoked;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt <= now;
  }

  isReplay(): boolean {
    return this.revoked && this.revokedReason === RefreshTokenRevocationReasons.ROTATED;
  }
}
