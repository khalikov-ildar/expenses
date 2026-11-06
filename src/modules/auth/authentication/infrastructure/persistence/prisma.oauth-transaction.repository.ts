import { OAuthTransaction } from '../../application/oauth/oauth-transaction.js';
import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { Injectable } from '@nestjs/common';
import {
  ConsumeOAuthTransactionInput,
  CreateOAuthTransactionInput,
  OAuthTransactionRepository,
} from '../../application/oauth/oauth-transaction.repository.js';

@Injectable()
export class PrismaOAuthTransactionRepository implements OAuthTransactionRepository {
  constructor(private prisma: PrismaClientProvider) {}

  async create(input: CreateOAuthTransactionInput): Promise<void> {
    await this.prisma.client.orm.public.OAuthTransaction.create({
      id: input.id,
      browserBindingHash: input.browserBindingHash,
      codeVerifier: input.codeVerifier,
      expiresAt: fromDate(input.expiresAt),
      stateHash: input.stateHash,
      provider: input.provider,
      purpose: input.purpose,
      userId: input.userId,
    });
  }

  async consume(input: ConsumeOAuthTransactionInput): Promise<OAuthTransaction | null> {
    const now = fromDate(input.now);
    const plan = this.prisma.client.sql.public.oAuthTransaction
      .update({ consumedAt: now })
      .where((t, fns) =>
        fns.and(
          fns.eq(t.provider, input.provider),
          fns.eq(t.stateHash, input.stateHash),
          fns.eq(t.browserBindingHash, input.browserBindingHash),
          fns.eq(t.consumedAt, null),
          fns.gt(t.expiresAt, now),
        ),
      )
      .build();
    const { affectedRows } = await this.prisma.runtime.execute(plan);

    if (affectedRows !== 1) {
      return null;
    }

    const row = await this.prisma.client.orm.public.OAuthTransaction.where({ stateHash: input.stateHash }).first();

    if (!row) return null;

    return {
      id: row.id,
      provider: row.provider as AuthKind,
      purpose: row.purpose as OAuthTransaction['purpose'],
      stateHash: row.stateHash,
      browserBindingHash: row.browserBindingHash,
      codeVerifier: row.codeVerifier,
      userId: row.userId ? AuthUserIdFactory.create(row.userId) : null,
      expiresAt: new Date(row.expiresAt.epochMilliseconds),
      consumedAt: row.consumedAt ? fromInstant(row.consumedAt) : null,
    };
  }
}
