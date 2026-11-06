import {
  RefreshTokenFamily,
  RefreshTokenFamilyId,
  RefreshTokenRevocationReason,
} from '@/modules/auth/session/domain/refresh-token-family.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { RefreshToken, RefreshTokenId } from '@auth/session/domain/refresh-token.js';

export interface RefreshTokenState {
  token: RefreshToken;
  family: RefreshTokenFamily;
}

export abstract class RefreshTokenRepository {
  /** Must execute inside the caller's DB transaction and lock both rows. */
  abstract findForUpdate(id: RefreshTokenId, userId: IdentityId): Promise<RefreshTokenState | null>;

  abstract createFamily(family: RefreshTokenFamily, initialToken: RefreshToken): Promise<void>;

  /** Must execute inside the caller's DB transaction. */
  abstract rotate(previous: RefreshToken, replacement: RefreshToken): Promise<void>;

  abstract revokeFamily(familyId: RefreshTokenFamilyId, reason: RefreshTokenRevocationReason): Promise<void>;

  abstract revokeAllForUser(userId: IdentityId, reason: RefreshTokenRevocationReason): Promise<void>;
}
