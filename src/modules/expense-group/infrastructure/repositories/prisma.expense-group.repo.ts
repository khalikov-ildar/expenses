import { ExpenseGroupRepository } from '../../application/ports/expense-group.repository.js';
import { Currency } from '../../domain/currency.js';
import { GroupInvitationStatus } from '../../domain/group-invitation.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';
import { Injectable } from '@nestjs/common';
import { PrismaClientProvider } from '@shared/infrastructure/database/transaction/prisma.client-provider.js';
import {
  ExpenseGroup,
  ExpenseGroupId,
  ExpenseGroupIdFactory,
  ExpenseGroupStatus,
} from '@expense-group/domain/expense-group.js';

type ExpenseGroupOrm = NonNullable<Awaited<ReturnType<typeof db.orm.public.ExpenseGroup.first>>>;

@Injectable()
export class PrismaExpenseGroupRepostiory implements ExpenseGroupRepository {
  constructor(private prismaProvider: PrismaClientProvider) {}
  async getCurrent(identityId: IdentityId, limit: number): Promise<ExpenseGroup[]> {
    const groups = await this.prismaProvider.client.orm.public.ExpenseGroup.where({ createdByIdentityId: identityId })
      .limit(limit)
      .all();
    return groups.map(this.toDomain);
  }

  async findCandidatesForActivation(limit: number): Promise<ExpenseGroup[]> {
    const plan = this.prismaProvider.client.sql.public.expenseGroup
      .select('id', 'name', 'status', 'createdByIdentityId', 'baseCurrency')
      .where((f, fns) =>
        fns.and(
          fns.eq(f.status, ExpenseGroupStatus.PENDING),
          fns.notExists(
            this.prismaProvider.client.sql.public.expenseGroupInvitation
              .select('id')
              .where((invitation, fns) =>
                fns.and(
                  fns.eq(invitation.expenseGroupId, f.id),
                  fns.notIn(invitation.status, [GroupInvitationStatus.ACCEPTED, GroupInvitationStatus.REJECTED]),
                ),
              ),
          ),
        ),
      )
      .orderBy('id', { direction: 'asc' })
      .limit(limit)
      .build();

    const rows = await this.prismaProvider.runtime.query(plan);

    return rows.map((row) =>
      ExpenseGroup.rehydrate(
        ExpenseGroupIdFactory.create(row.id),
        row.name,
        row.status,
        AuthUserIdFactory.create(row.createdByIdentityId),
        Currency.create(row.baseCurrency),
      ),
    );
  }

  async changeStatus(
    id: ExpenseGroupId,
    status: ExpenseGroupStatus,
    expectedStatus: ExpenseGroupStatus,
  ): Promise<boolean> {
    const count = await this.prismaProvider.client.orm.public.ExpenseGroup.where({
      status: expectedStatus,
      id,
    }).updateAndCount({ status });
    return count !== 0;
  }

  async getById(id: ExpenseGroupId): Promise<ExpenseGroup> {
    const row = await this.prismaProvider.client.orm.public.ExpenseGroup.where({ id }).first();
    if (!row) {
      throw DomainErrors.notFound('expense_group.not_found', 'expense_group_was_not_found', { groupId: id });
    }
    return this.toDomain(row);
  }

  async lockById(id: ExpenseGroupId): Promise<void> {
    const plan = db.raw.sql`
    SELECT "id"
    FROM "expenseGroup"
    WHERE "id" = ${id}
    FOR UPDATE
  `.affectedCount();

    await this.prismaProvider.runtime.query(plan.build());
  }

  async cancelIfCancellable(id: ExpenseGroupId): Promise<boolean> {
    const plan = this.prismaProvider.client.sql.public.expenseGroup
      .update({ status: ExpenseGroupStatus.CANCELLED })
      .where((f, fns) =>
        fns.and(fns.eq(f.id, id), fns.in(f.status, [ExpenseGroupStatus.ACTIVE, ExpenseGroupStatus.PENDING])),
      );

    const { affectedRows } = await this.prismaProvider.runtime.execute(plan.build());
    if (affectedRows === 0) {
      return false;
    }
    return true;
  }

  async save(eg: ExpenseGroup): Promise<void> {
    await this.prismaProvider.client.orm.public.ExpenseGroup.create({
      id: eg.id,
      name: eg.name,
      status: eg.status,
      createdByIdentityId: eg.createdBy,
      baseCurrency: eg.baseCurrency.code,
    });
  }

  private toDomain(row: ExpenseGroupOrm): ExpenseGroup {
    return ExpenseGroup.rehydrate(
      ExpenseGroupIdFactory.create(row.id),
      row.name,
      row.status,
      AuthUserIdFactory.create(row.createdByIdentityId),
      Currency.create(row.baseCurrency),
    );
  }
}
