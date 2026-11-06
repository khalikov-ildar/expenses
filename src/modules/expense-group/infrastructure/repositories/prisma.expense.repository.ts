import { Injectable } from '@nestjs/common';
import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { ExpenseCursor, ExpenseRepository } from '../../application/ports/expense.repository.js';
import { Expense, ExpenseId, ExpenseIdFactory } from '../../domain/expense.js';
import { Currency, Money } from '../../domain/currency.js';
import { ExchangeRate } from '../../domain/exchange-rate.js';
import { ExpenseGroupId, ExpenseGroupIdFactory } from '../../domain/expense-group.js';
import { GroupMemberIdFactory } from '../../domain/group-member.js';
import {
  createPageSlice,
  getOffset,
  normalizeOffsetPageRequest,
  OffsetPageRequest,
  PageSlice,
} from '@/shared/application/pagination/pagination.js';

type ExpenseRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.Expense.first>>>;
type ParticipantRow = Awaited<ReturnType<typeof db.orm.public.ExpenseParticipant.all>>[number];
type ExpenseInsert = Parameters<typeof db.orm.public.Expense.create>[0];
type ParticipantInsert = Parameters<typeof db.orm.public.ExpenseParticipant.createAll>[0][number];
const expenseColumns = db.sql.public.expense.columns;

@Injectable()
export class PrismaExpenseRepository implements ExpenseRepository {
  constructor(private readonly prisma: PrismaClientProvider) {}

  async getById(id: ExpenseId): Promise<Expense> {
    const row = await this.prisma.client.orm.public.Expense.first({ id });
    if (!row) {
      throw DomainErrors.notFound('expense_group.expense.not_found', 'The expense does not exist.', { expenseId: id });
    }
    const participantRows = await this.prisma.client.orm.public.ExpenseParticipant.where({ expenseId: id }).all();
    return this.toDomain(row, participantRows);
  }

  async getPageByGroupId(groupId: ExpenseGroupId, request: OffsetPageRequest): Promise<PageSlice<Expense>> {
    const rows = await this.prisma.client.orm.public.Expense.where({ groupId })
      .include('participants')
      .orderBy([(expense) => expense.createdAt.desc(), (expense) => expense.id.desc()])
      .offset(getOffset(request))
      .limit(request.limit + 1)
      .all();

    const hasNextPage = rows.length > request.limit;
    const pageRows = hasNextPage ? rows.slice(0, request.limit) : rows;

    const items = pageRows.map((row) => this.toDomain(row, row.participants));

    return createPageSlice(items, request, hasNextPage);
  }

  async save(expense: Expense): Promise<void> {
    const row: ExpenseInsert = {
      id: expense.id,
      groupId: expense.groupId,
      createdByMemberId: expense.createdByMemberId,
      paidByMemberId: expense.paidByMemberId,
      description: expense.description,
      originalAmountMinor: expense.originalAmount.minorUnits,
      originalCurrency: expense.originalAmount.currency.code,
      baseAmountMinor: expense.baseAmount.minorUnits,
      baseCurrency: expense.baseAmount.currency.code,
      exchangeRateNumerator: expense.exchangeRate?.numerator.toString() ?? null,
      exchangeRateDenominator: expense.exchangeRate?.denominator.toString() ?? null,
      exchangeRateProvider: expense.exchangeRate?.provider ?? null,
      exchangeRateQuotedAt: expense.exchangeRate
        ? Temporal.Instant.fromEpochMilliseconds(expense.exchangeRate.quotedAt.getTime())
        : null,
      createdAt: Temporal.Instant.fromEpochMilliseconds(expense.createdAt.getTime()),
    };
    const participants: ParticipantInsert[] = expense.participants.map((participant) => ({
      expenseId: expense.id,
      memberId: participant.memberId,
      groupId: expense.groupId,
      amountMinor: participant.amountMinor,
    }));

    await this.prisma.client.orm.public.Expense.create(row);
    if (participants.length > 0) {
      await this.prisma.client.orm.public.ExpenseParticipant.createAll(participants);
    }
  }

  private toDomain(row: ExpenseRow, participants: ParticipantRow[]): Expense {
    const originalCurrency = Currency.create(row.originalCurrency);
    const baseCurrency = Currency.create(row.baseCurrency);
    const rateFields = [
      row.exchangeRateNumerator,
      row.exchangeRateDenominator,
      row.exchangeRateProvider,
      row.exchangeRateQuotedAt,
    ];
    const hasAnyRateField = rateFields.some((value) => value !== null);
    const hasAllRateFields = rateFields.every((value) => value !== null);
    if (hasAnyRateField !== hasAllRateFields) {
      throw DomainErrors.invalid(
        'expense_group.expense.corrupt_exchange_rate',
        'The stored exchange-rate snapshot is incomplete.',
        { expenseId: row.id },
      );
    }
    const exchangeRate = hasAllRateFields
      ? ExchangeRate.create({
          from: originalCurrency,
          to: baseCurrency,
          numerator: BigInt(row.exchangeRateNumerator!),
          denominator: BigInt(row.exchangeRateDenominator!),
          provider: row.exchangeRateProvider!,
          quotedAt: fromInstant(row.exchangeRateQuotedAt!),
        })
      : null;
    return Expense.rehydrate({
      id: ExpenseIdFactory.create(row.id),
      groupId: ExpenseGroupIdFactory.create(row.groupId),
      createdByMemberId: GroupMemberIdFactory.create(row.createdByMemberId),
      paidByMemberId: GroupMemberIdFactory.create(row.paidByMemberId),
      description: row.description,
      originalAmount: Money.fromMinorUnits(row.originalAmountMinor, originalCurrency),
      baseAmount: Money.fromMinorUnits(row.baseAmountMinor, baseCurrency),
      exchangeRate,
      participants: participants.map((participant) => ({
        memberId: GroupMemberIdFactory.create(participant.memberId),
        amountMinor: participant.amountMinor,
      })),
      createdAt: fromInstant(row.createdAt),
    });
  }
}
