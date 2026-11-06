import { OffsetPageRequest, PageSlice } from '@/shared/application/pagination/pagination.js';
import { ExpenseGroupId } from '../../domain/expense-group.js';
import { Expense, ExpenseId } from '../../domain/expense.js';

export interface ExpenseCursor {
  createdAt: Date;
  id: string;
}

export abstract class ExpenseRepository {
  abstract getPageByGroupId(groupId: ExpenseGroupId, request: OffsetPageRequest): Promise<PageSlice<Expense>>;
  abstract getById(id: ExpenseId): Promise<Expense>;
  abstract save(expense: Expense): Promise<void>;
}
