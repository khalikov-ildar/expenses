import { Injectable } from '@nestjs/common';
import { ExternalIdentityRepository } from '../../application/ports/external-identity.repository.js';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { ExternalIdentity, ExternalIdentityIdFactory, OAuthProvider } from '../../domain/external-identity.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';

@Injectable()
export class PrismaExternalIdentityRepository implements ExternalIdentityRepository {
  constructor(private prisma: PrismaClientProvider) {}

  async find(provider: OAuthProvider, providerUserId: string): Promise<ExternalIdentity | null> {
    const data = await this.prisma.client.orm.public.ExternalIdentity.where({
      provider: provider,
      providerUserId: providerUserId,
    }).first();

    return data
      ? new ExternalIdentity(
          ExternalIdentityIdFactory.create(data.id),
          data.provider,
          data.providerUserId,
          AuthUserIdFactory.create(data.userId),
        )
      : null;
  }
  async save(identity: ExternalIdentity): Promise<void> {
    await this.prisma.client.orm.public.ExternalIdentity.create(identity);
  }
}
