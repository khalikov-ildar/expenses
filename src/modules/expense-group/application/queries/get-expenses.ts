import { Injectable } from '@nestjs/common';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { ExpenseRepository } from '../ports/expense.repository.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { ExpenseGroupIdFactory } from '../../domain/expense-group.js';
import { OffsetPageRequest, PageSlice } from '@/shared/application/pagination/pagination.js';
import { Expense } from '../../domain/expense.js';

export class GetExpensesForGroupQuery {
  constructor(
    public readonly groupId: string,
    public readonly actorId: IdentityId,
    public readonly pagination: OffsetPageRequest,
  ) {}
}

@Injectable()
export class GetExpensesForGroup {
  constructor(
    private readonly expenseRepo: ExpenseRepository,
    private readonly memberRepo: GroupMemberRepository,
  ) {}

  async execute(query: GetExpensesForGroupQuery): Promise<PageSlice<ExpenseResponse>> {
    const groupId = ExpenseGroupIdFactory.create(query.groupId);

    // Keep the existing authorization rule.
    await this.memberRepo.getActiveByGroupAndIdentity(groupId, query.actorId);

    const result = await this.expenseRepo.getPageByGroupId(groupId, query.pagination);

    return {
      ...result,
      items: result.items.map((expense) => this.toResponse(expense)),
    };
  }

  private toResponse(e: Expense): ExpenseResponse {
    return {
      id: e.id,
      groupId: e.groupId,
      description: e.description,
      participants: e.participants.map((p) => ({
        memberId: p.memberId,
        amountMinor: p.amountMinor.toString(),
      })),
      originalAmount: {
        minorUnits: e.originalAmount.minorUnits.toString(),
        code: e.originalAmount.currency.code,
        minorUnitDigits: e.originalAmount.currency.minorUnitDigits,
      },
      createdByMemberId: e.createdByMemberId,
      paidByMemberId: e.paidByMemberId,
      exchangeRate: e.exchangeRate
        ? {
            from: e.exchangeRate.from.code,
            to: e.exchangeRate.to.code,
            quotedAt: e.exchangeRate.quotedAt,
            numerator: e.exchangeRate.numerator.toString(),
            denominator: e.exchangeRate.denominator.toString(),
          }
        : null,
      baseAmount: {
        code: e.baseAmount.currency.code,
        minorUnitDigits: e.baseAmount.currency.minorUnitDigits,
        minorUnits: e.baseAmount.minorUnits.toString(),
      },
      createdAt: e.createdAt,
    };
  }
}

export interface ExpenseResponse {
  id: string;
  groupId: string;
  description: string;
  participants: {
    memberId: string;
    amountMinor: string;
  }[];
  originalAmount: {
    minorUnits: string;
    code: string;
    minorUnitDigits: number;
  };
  createdByMemberId: string;
  paidByMemberId: string;
  exchangeRate: {
    from: string;
    to: string;
    quotedAt: Date;
    numerator: string;
    denominator: string;
  } | null;
  baseAmount: {
    code: string;
    minorUnitDigits: number;
    minorUnits: string;
  };
  createdAt: Date;
}
