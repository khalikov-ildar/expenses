import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { ExpenseGroupIdFactory, ExpenseGroupStatus } from '../../domain/expense-group.js';
import { GroupMemberBalance, GroupBalanceRepository } from '../ports/group-balance.repository.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';

export class GetGroupBalancesQuery {
  constructor(
    readonly groupId: string,
    readonly actorId: IdentityId,
  ) {}
}

export interface GroupBalanceResponse {
  groupId: string;
  currency: string;
  balances: {
    memberId: string;
    status: string;
    paidMinor: string;
    owedMinor: string;
    netMinor: string;
  }[];
}

@Injectable()
export class GetGroupBalances {
  constructor(
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly memberRepo: GroupMemberRepository,
    private readonly balanceRepo: GroupBalanceRepository,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(query: GetGroupBalancesQuery): Promise<GroupBalanceResponse> {
    return executeWithLogging(
      this.logger,
      'expense_group.balance.get',
      { group_id: query.groupId, actor_id: query.actorId },
      async () => {
        const groupId = ExpenseGroupIdFactory.create(query.groupId);

        await this.memberRepo.getActiveByGroupAndIdentity(groupId, query.actorId);

        const group = await this.groupRepo.getById(groupId);

        if (group.status !== ExpenseGroupStatus.ACTIVE) {
          throw DomainErrors.conflict(
            'expense_group.group.not_active',
            'Balances are only available for active groups.',
            { groupId },
          );
        }

        const balances = await this.balanceRepo.getByGroupId(groupId);

        return {
          groupId,
          currency: group.baseCurrency.code,
          balances: balances.map((balance) => this.toResponse(balance)),
        };
      },
    );
  }

  private toResponse(balance: GroupMemberBalance) {
    const netMinor = balance.paidMinor - balance.owedMinor;

    return {
      memberId: balance.memberId,
      status: balance.status,
      paidMinor: balance.paidMinor.toString(),
      owedMinor: balance.owedMinor.toString(),
      netMinor: netMinor.toString(),
    };
  }
}
