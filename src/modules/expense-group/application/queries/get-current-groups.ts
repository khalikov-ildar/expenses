import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';

export class GetCurrentGroupsQuery {
  constructor(public userId: IdentityId) {}
}

@Injectable()
export class GetCurrentGroups {
  constructor(private groupRepo: ExpenseGroupRepository) {}

  async execute(query: GetCurrentGroupsQuery) {
    return this.groupRepo.getCurrent(query.userId, 50);
  }
}
