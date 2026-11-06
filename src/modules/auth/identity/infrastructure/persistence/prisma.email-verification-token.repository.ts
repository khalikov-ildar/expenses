import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { Injectable } from '@nestjs/common';
import {
  ConsumedEmailVerificationToken,
  EmailVerificationTokenRepository,
} from '../../application/ports/email-verification-token-repository.js';

const evt = db.sql.public.emailVerificationToken.columns;

@Injectable()
export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClientProvider) {}

  async revokeActiveForUser(userId: IdentityId, now: Date): Promise<void> {
    await this.prisma.client.orm.public.EmailVerificationToken.where({
      userId,
      consumedAt: null,
    }).updateAll({
      consumedAt: fromDate(now),
    });
  }

  async create(input: { id: string; userId: IdentityId; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.client.orm.public.EmailVerificationToken.create({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: fromDate(input.expiresAt),
    });
  }

  async consumeValid(tokenHash: string, now: Date): Promise<ConsumedEmailVerificationToken | null> {
    const plan = db.raw.sql`
      UPDATE "emailVerificationToken"
      SET "consumedAt" = ${now.toISOString()}
      WHERE "tokenHash" = ${tokenHash}
        AND "consumedAt" IS NULL
        AND "expiresAt" > ${now.toISOString()}
      RETURNING "id", "userId", "expiresAt"
    `.returnsRow({
      id: evt.id,
      userId: evt.userId,
      expiresAt: evt.expiresAt,
    });

    const rows = await this.prisma.runtime.query(plan.build());
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: AuthUserIdFactory.create(row.userId),
      expiresAt: fromInstant(row.expiresAt),
    } satisfies ConsumedEmailVerificationToken;
  }
}
