import { IdentityId } from '@/shared/domain/id/auth.js';
import { ExpenseGroupMember, GroupMemberId, GroupMemberStatus } from '../../domain/group-member.js';
import { ExpenseGroupId } from '../../domain/expense-group.js';

export abstract class GroupMemberRepository {
  abstract getById(id: GroupMemberId): Promise<ExpenseGroupMember>;
  abstract getByIds(id: GroupMemberId[]): Promise<ExpenseGroupMember[]>;
  abstract getActiveByGroupId(groupId: ExpenseGroupId): Promise<ExpenseGroupMember[]>;
  abstract countActiveByGroup(groupId: ExpenseGroupId): Promise<number>;
  abstract getActiveByGroupAndIdentity(groupId: ExpenseGroupId, identityId: IdentityId): Promise<ExpenseGroupMember>;
  abstract saveMany(ms: ExpenseGroupMember[]): Promise<void>;
  abstract saveStatusChange(m: ExpenseGroupMember, expectedStatus: GroupMemberStatus): Promise<boolean>;
}
