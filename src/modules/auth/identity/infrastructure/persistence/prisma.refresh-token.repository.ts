import {
  RefreshTokenFamily,
  RefreshTokenFamilyId,
  RefreshTokenFamilyIdFactory,
  RefreshTokenRevocationReason,
} from '@/modules/auth/session/domain/refresh-token-family.js';
import { RefreshTokenRepository, RefreshTokenState } from '../../application/ports/refresh-token.repository.js';
import { RefreshToken, RefreshTokenId, RefreshTokenIdFactory } from '@/modules/auth/session/domain/refresh-token.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { Injectable } from '@nestjs/common';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';

const rt = db.sql.public.refreshToken.columns;
const rf = db.sql.public.refreshTokenFamily.columns;

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClientProvider) {}

  async findForUpdate(id: RefreshTokenId, userId: IdentityId): Promise<RefreshTokenState | null> {
    // Must run inside the caller's transaction. Locks both the token and its family,
    // so two concurrent refreshes of the same token serialize at the DB level.
    const plan = db.raw.sql`
      SELECT
        rt."id",
        rt."familyId",
        rt."tokenHash",
        rt."expiresAt",
        rt."generation",
        rt."parentId",
        rt."replacedById",
        rt."revoked",
        rt."revokedAt",
        rt."revokedReason",
        rf."userId" AS "familyUserId",
        rf."createdAt" AS "familyCreatedAt",
        rf."expiresAt" AS "familyExpiresAt",
        rf."revokedAt" AS "familyRevokedAt",
        rf."revokedReason" AS "familyRevokedReason"
      FROM "refreshToken" rt
      INNER JOIN "refreshTokenFamily" rf
        ON rf."id" = rt."familyId"
      WHERE rt."id" = ${id}
        AND rf."userId" = ${userId}
      FOR UPDATE OF rt, rf
    `.returnsRow({
      id: rt.id,
      familyId: rt.familyId,
      tokenHash: rt.tokenHash,
      expiresAt: rt.expiresAt,
      generation: rt.generation,
      parentId: rt.parentId,
      replacedById: rt.replacedById,
      revoked: rt.revoked,
      revokedAt: rt.revokedAt,
      revokedReason: rt.revokedReason,
      familyUserId: rf.userId,
      familyCreatedAt: rf.createdAt,
      familyExpiresAt: rf.expiresAt,
      familyRevokedAt: rf.revokedAt,
      familyRevokedReason: rf.revokedReason,
    });

    const rows = await this.prisma.runtime.query(plan.build());
    const row = rows[0];

    if (!row) {
      return null;
    }

    const familyId = RefreshTokenFamilyIdFactory.create(row.familyId);
    const family = RefreshTokenFamily.fromPersistence({
      id: familyId,
      userId: AuthUserIdFactory.create(row.familyUserId),
      createdAt: fromInstant(row.familyCreatedAt),
      expiresAt: fromInstant(row.familyExpiresAt),
      revokedAt: row.familyRevokedAt ? fromInstant(row.familyRevokedAt) : null,
      revokedReason: row.familyRevokedReason as RefreshTokenRevocationReason | null,
    });

    const token = RefreshToken.fromPersistence({
      id: RefreshTokenIdFactory.create(row.id),
      familyId,
      token: row.tokenHash,
      expiresAt: fromInstant(row.expiresAt),
      generation: row.generation,
      parentId: row.parentId ? RefreshTokenIdFactory.create(row.parentId) : null,
      replacedById: row.replacedById ? RefreshTokenIdFactory.create(row.replacedById) : null,
      revoked: row.revoked,
      revokedAt: row.revokedAt ? fromInstant(row.revokedAt) : null,
      revokedReason: row.revokedReason as RefreshTokenRevocationReason | null,
    });

    return { token, family };
  }

  async createFamily(family: RefreshTokenFamily, initialToken: RefreshToken): Promise<void> {
    if (initialToken.familyId !== family.id) {
      throw new Error('Refresh token does not belong to the supplied family');
    }

    if (initialToken.generation !== 0 || initialToken.parentId !== null) {
      throw new Error('Initial refresh token must be generation 0 without a parent');
    }

    // TokenIssuer is called inside TransactionManager.run(). Both inserts therefore
    // commit or roll back together.
    await this.prisma.client.orm.public.RefreshTokenFamily.create({
      id: family.id,
      userId: family.userId,
      createdAt: fromDate(family.createdAt),
      expiresAt: fromDate(family.expiresAt),
      revokedAt: family.revokedAt ? fromDate(family.revokedAt) : null,
      revokedReason: family.revokedReason,
    });

    await this.prisma.client.orm.public.RefreshToken.create({
      id: initialToken.id,
      familyId: initialToken.familyId,
      tokenHash: initialToken.token,
      generation: initialToken.generation,
      parentId: initialToken.parentId,
      replacedById: initialToken.replacedById,
      expiresAt: fromDate(initialToken.expiresAt),
      revoked: initialToken.revoked,
      revokedAt: initialToken.revokedAt ? fromDate(initialToken.revokedAt) : null,
      revokedReason: initialToken.revokedReason,
    });
  }

  async rotate(previous: RefreshToken, replacement: RefreshToken): Promise<void> {
    if (previous.familyId !== replacement.familyId) {
      throw new Error('Refresh token rotation cannot change family');
    }

    if (replacement.parentId !== previous.id) {
      throw new Error('Refresh token replacement must point to the previous token');
    }

    if (replacement.generation !== previous.generation + 1) {
      throw new Error('Refresh token generation must increment by one');
    }

    if (!previous.revoked || previous.revokedReason !== 'ROTATED') {
      throw new Error('Previous refresh token must be marked as rotated before persistence');
    }

    if (previous.replacedById !== replacement.id) {
      throw new Error('Previous refresh token must point to its replacement');
    }

    if (replacement.revoked) {
      throw new Error('Replacement refresh token must be active');
    }

    await this.prisma.client.orm.public.RefreshToken.where({ id: previous.id }).update({
      revoked: true,
      revokedAt: previous.revokedAt ? fromDate(previous.revokedAt) : null,
      revokedReason: previous.revokedReason,
      replacedById: previous.replacedById,
    });

    await this.prisma.client.orm.public.RefreshToken.create({
      id: replacement.id,
      familyId: replacement.familyId,
      tokenHash: replacement.token,
      generation: replacement.generation,
      parentId: replacement.parentId,
      replacedById: replacement.replacedById,
      expiresAt: fromDate(replacement.expiresAt),
      revoked: false,
      revokedAt: null,
      revokedReason: null,
    });
  }

  async revokeFamily(familyId: RefreshTokenFamilyId, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.prisma.client.orm.public.RefreshTokenFamily.where({ id: familyId, revokedAt: null }).update({
      revokedAt: Temporal.Now.instant(),
      revokedReason: reason,
    });
  }

  async revokeAllForUser(userId: IdentityId, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.prisma.client.orm.public.RefreshTokenFamily.where({ userId, revokedAt: null }).updateAll({
      revokedAt: Temporal.Now.instant(),
      revokedReason: reason,
    });
  }
}
