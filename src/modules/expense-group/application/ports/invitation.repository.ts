import { GroupInvitation, GroupInvitationId, GroupInvitationStatus } from '@expense-group/domain/group-invitation.js';
import { ExpenseGroupId } from '../../domain/expense-group.js';
import { OffsetPageRequest, PageSlice } from '@/shared/application/pagination/pagination.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { PendingInvitationItem } from '../queries/get-pending-invitations.js';

export abstract class GroupInvitationRepository {
  abstract getPendingInvitations(
    identityId: IdentityId,
    request: OffsetPageRequest,
  ): Promise<PageSlice<PendingInvitationItem>>;
  abstract getExpiredCandidates(now: Date, amount: number): Promise<GroupInvitation[]>;
  abstract getById(id: GroupInvitationId): Promise<GroupInvitation>;
  abstract countPendingForGroup(groupId: ExpenseGroupId): Promise<number>;
  abstract saveMany(invs: GroupInvitation[]): Promise<void>;
  abstract saveStatusChange(i: GroupInvitation, expectedStatus: GroupInvitationStatus): Promise<boolean>;
  abstract cancelForGroup(groupId: ExpenseGroupId): Promise<number>;
}
