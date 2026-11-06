import { Injectable } from '@nestjs/common';
import { PrismaClientProvider } from '@shared/infrastructure/database/transaction/prisma.client-provider.js';
import {
  GroupInvitation,
  GroupInvitationId,
  GroupInvitationIdFactory,
  GroupInvitationStatus,
} from '@expense-group/domain/group-invitation.js';
import { db } from '@shared/infrastructure/database/prisma/db.js';
import { GroupMemberIdFactory } from '@expense-group/domain/group-member.js';
import { ExpenseGroupId, ExpenseGroupIdFactory } from '@expense-group/domain/expense-group.js';
import { GroupInvitationRepository } from '../../application/ports/invitation.repository.js';
import { fromInstant } from '@/shared/domain/date.converter.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import {
  createPageSlice,
  getOffset,
  OffsetPageRequest,
  PageSlice,
} from '@/shared/application/pagination/pagination.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { PendingInvitationItem } from '../../application/queries/get-pending-invitations.js';

type GroupInvitationOrm = Parameters<typeof db.orm.public.ExpenseGroupInvitation.createAll>[0][number];

const invitation = db.sql.public.expenseGroupInvitation.columns;

@Injectable()
export class PrismaGroupInvitationRepository implements GroupInvitationRepository {
  constructor(private prisma: PrismaClientProvider) {}

  async getPendingInvitations(
    identityId: IdentityId,
    request: OffsetPageRequest,
  ): Promise<PageSlice<PendingInvitationItem>> {
    const rows = await this.prisma.client.orm.public.ExpenseGroupInvitation.where({
      status: GroupInvitationStatus.PENDING,
    })
      .where((i) => i.invitee.some((member) => member.identityId.eq(identityId)))
      .include('group')
      .include('inviter')
      .orderBy([(i) => i.createdAt.desc(), (expense) => expense.id.desc()])
      .offset(getOffset(request))
      .limit(request.limit + 1)
      .all();

    const hasNextPage = rows.length > request.limit;
    const pageRows = hasNextPage ? rows.slice(0, request.limit) : rows;

    const items = pageRows.map(
      (r) =>
        ({
          id: r.id,
          groupId: r.group.id,
          groupName: r.group.name,
          invitedAt: fromInstant(r.createdAt),
          invitedById: r.inviterId,
        }) satisfies PendingInvitationItem,
    );
    return createPageSlice(items, request, hasNextPage);
  }

  async getExpiredCandidates(now: Date, amount: number): Promise<GroupInvitation[]> {
    const plan = db.raw.sql`
    SELECT
      "id",
      "expenseGroupId",
      "inviterId",
      "inviteeId",
      "expiresAt",
      "status"
    FROM "expenseGroupInvitation"
    WHERE "status" = 'PENDING'
      AND "expiresAt" <= ${now.toISOString()}
    ORDER BY "expiresAt", "id"
    LIMIT ${amount}
    FOR UPDATE SKIP LOCKED
    `.returnsRow({
      id: invitation.id,
      expenseGroupId: invitation.expenseGroupId,
      inviterId: invitation.inviterId,
      inviteeId: invitation.inviteeId,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    });

    const rows = await this.prisma.runtime.query(plan.build());
    return rows.map((r) =>
      GroupInvitation.rehydrate({
        id: GroupInvitationIdFactory.create(r.id),
        groupId: ExpenseGroupIdFactory.create(r.expenseGroupId),
        inviteeId: GroupMemberIdFactory.create(r.inviteeId),
        inviterId: GroupMemberIdFactory.create(r.inviterId),
        expiresAt: fromInstant(r.expiresAt),
        status: r.status,
      }),
    );
  }

  async countPendingForGroup(groupId: ExpenseGroupId): Promise<number> {
    const result = await this.prisma.client.orm.public.ExpenseGroupInvitation.where({
      expenseGroupId: groupId,
      status: GroupInvitationStatus.PENDING,
    }).aggregate((a) => ({
      count: a.count(),
    }));
    return result.count;
  }

  async cancelForGroup(groupId: ExpenseGroupId): Promise<number> {
    return this.prisma.client.orm.public.ExpenseGroupInvitation.where({
      expenseGroupId: groupId,
      status: GroupInvitationStatus.PENDING,
    }).updateAndCount({ status: GroupInvitationStatus.CANCELLED });
  }

  async getById(id: GroupInvitationId): Promise<GroupInvitation> {
    const result = await this.prisma.client.orm.public.ExpenseGroupInvitation.first({ id });
    if (!result) {
      throw DomainErrors.notFound('expense_group.invitation.not_found', 'The group invitation does not exist.', {
        invitationId: id,
      });
    }
    return this.mapToDomain(result);
  }

  async saveMany(invs: GroupInvitation[]): Promise<void> {
    const client = this.prisma.client.orm.public;
    const ormInvitations = invs.map((i) => this.mapToOrm(i));
    await client.ExpenseGroupInvitation.createAll(ormInvitations);
  }

  async saveStatusChange(i: GroupInvitation, expectedStatus: GroupInvitationStatus): Promise<boolean> {
    const client = this.prisma.client.orm.public;
    const updatedRows = await client.ExpenseGroupInvitation.where({ id: i.id, status: expectedStatus }).updateAndCount({
      status: i.status,
    });
    return updatedRows === 1;
  }

  private mapToOrm(i: GroupInvitation): GroupInvitationOrm {
    return {
      id: i.id,
      expenseGroupId: i.groupId,
      expiresAt: Temporal.Instant.fromEpochMilliseconds(i.expiresAt.getTime()),
      inviteeId: i.inviteeId,
      inviterId: i.inviterId,
      status: i.status,
    };
  }

  private mapToDomain(i: GroupInvitationOrm): GroupInvitation {
    return GroupInvitation.rehydrate({
      id: GroupInvitationIdFactory.create(i.id),
      inviteeId: GroupMemberIdFactory.create(i.inviteeId),
      inviterId: GroupMemberIdFactory.create(i.inviterId),
      groupId: ExpenseGroupIdFactory.create(i.expenseGroupId),
      expiresAt: new Date(i.expiresAt.epochMilliseconds),
      status: i.status!,
    });
  }
}
