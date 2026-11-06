import { ExpenseGroupId } from '../../domain/expense-group.js';
import { GroupMemberId, GroupMemberStatus } from '../../domain/group-member.js';

export interface GroupMemberBalance {
  memberId: GroupMemberId;
  status: GroupMemberStatus;
  paidMinor: bigint;
  owedMinor: bigint;
}

export abstract class GroupBalanceRepository {
  abstract getByGroupId(groupId: ExpenseGroupId): Promise<GroupMemberBalance[]>;
}
