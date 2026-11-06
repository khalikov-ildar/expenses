import { Injectable } from '@nestjs/common';
import { AuthUserRepository } from '../../application/ports/auth-user.repository.js';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { AuthUser } from '../../domain/auth-user.js';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';

@Injectable()
export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private prisma: PrismaClientProvider) {}

  async findById(id: IdentityId): Promise<AuthUser | null> {
    const data = await this.prisma.client.orm.public.User.where({ id }).first();

    return data
      ? AuthUser.fromPersistence({
          id: AuthUserIdFactory.create(data.id),
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          emailVerifiedAt: data.emailVerifiedAt ? fromInstant(data.emailVerifiedAt) : null,
        })
      : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const data = await this.prisma.client.orm.public.User.where({ email }).first();
    return data
      ? AuthUser.fromPersistence({
          id: AuthUserIdFactory.create(data.id),
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          emailVerifiedAt: data.emailVerifiedAt ? fromInstant(data.emailVerifiedAt) : null,
        })
      : null;
  }

  async save(user: AuthUser): Promise<void> {
    await this.prisma.client.orm.public.User.create({
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
    });
  }

  async update(user: AuthUser): Promise<void> {
    await this.prisma.client.orm.public.User.where({ id: user.id }).update({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      emailVerifiedAt: user.emailVerifiedAt ? fromDate(user.emailVerifiedAt) : null,
    });
  }
}
