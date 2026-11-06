import { IdentityId } from '@/shared/domain/id/auth.js';
import { ExpenseGroup, ExpenseGroupId, ExpenseGroupStatus } from '@expense-group/domain/expense-group.js';

export abstract class ExpenseGroupRepository {
  abstract getById(id: ExpenseGroupId): Promise<ExpenseGroup>;
  abstract getCurrent(identityId: IdentityId, limit: number): Promise<ExpenseGroup[]>;
  abstract lockById(id: ExpenseGroupId): Promise<void>;
  abstract cancelIfCancellable(id: ExpenseGroupId): Promise<boolean>;
  abstract save(eg: ExpenseGroup): Promise<void>;
  abstract findCandidatesForActivation(limit: number): Promise<ExpenseGroup[]>;
  abstract changeStatus(
    id: ExpenseGroupId,
    status: ExpenseGroupStatus,
    expectedStatus: ExpenseGroupStatus,
  ): Promise<boolean>;
}
