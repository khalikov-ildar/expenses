import { Injectable } from '@nestjs/common';
import { GroupInvitationRepository } from '../ports/invitation.repository.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { OffsetPageRequest } from '@/shared/application/pagination/pagination.js';

export class GetPendingInvitationsQuery {
  constructor(
    public identityId: IdentityId,
    public request: OffsetPageRequest,
  ) {}
}

@Injectable()
export class GetPendingInvitations {
  constructor(private invitationRepo: GroupInvitationRepository) {}

  async execute(query: GetPendingInvitationsQuery) {
    return this.invitationRepo.getPendingInvitations(query.identityId, query.request);
  }
}

export interface PendingInvitationItem {
  id: string;
  groupId: string;
  groupName: string;
  invitedAt: Date;
  invitedById: string;
}
