import { Injectable } from '@nestjs/common';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';
import { ExpenseGroupId } from '../../domain/expense-group.js';
import { GroupMemberIdFactory } from '../../domain/group-member.js';
import { GroupBalanceRepository, GroupMemberBalance } from '../../application/ports/group-balance.repository.js';

const member = db.sql.public.member.columns;
const expense = db.sql.public.expense.columns;
const participant = db.sql.public.expenseParticipant.columns;

@Injectable()
export class PrismaGroupBalanceRepository implements GroupBalanceRepository {
  constructor(private readonly prisma: PrismaClientProvider) {}

  async getByGroupId(groupId: ExpenseGroupId): Promise<GroupMemberBalance[]> {
    const plan = db.raw.sql`
      SELECT
        m."id" AS "memberId",
        m."status" AS "status",
        COALESCE(paid."paidMinor", 0)::bigint AS "paidMinor",
        COALESCE(owed."owedMinor", 0)::bigint AS "owedMinor"
      FROM "member" AS m

      LEFT JOIN (
        SELECT
          "paidByMemberId",
          SUM("baseAmountMinor") AS "paidMinor"
        FROM "expense"
        WHERE "groupId" = ${groupId}
        GROUP BY "paidByMemberId"
      ) AS paid
        ON paid."paidByMemberId" = m."id"

      LEFT JOIN (
        SELECT
          "memberId",
          SUM("amountMinor") AS "owedMinor"
        FROM "expenseParticipant"
        WHERE "groupId" = ${groupId}
        GROUP BY "memberId"
      ) AS owed
        ON owed."memberId" = m."id"

      WHERE m."groupId" = ${groupId}
        AND m."status" IN ('ACTIVE', 'LEFT')

      ORDER BY m."createdAt", m."id"
    `.returnsRow({
      memberId: member.id,
      status: member.status,
      paidMinor: expense.baseAmountMinor,
      owedMinor: participant.amountMinor,
    });

    const rows = await this.prisma.runtime.query(plan.build());

    return rows.map((row) => ({
      memberId: GroupMemberIdFactory.create(row.memberId),
      status: row.status,
      paidMinor: row.paidMinor,
      owedMinor: row.owedMinor,
    }));
  }
}
