import { ExpenseGroupIdFactory } from './expense-group.js';
import {
  GroupInvitation,
  GroupInvitationDecision,
  GroupInvitationIdFactory,
  GroupInvitationStatus,
} from './group-invitation.js';
import { GroupMemberIdFactory } from './group-member.js';
import {
  GroupInvitationAcceptedType,
  GroupInvitationExpiredType,
  GroupInvitationRejectedType,
} from './events/index.js';

describe('GroupInvitation', () => {
  const now = new Date('2026-11-12T10:00:00.000Z');

  function setup(expiresAt = new Date('2026-11-13T10:00:00.000Z')) {
    const clock = { now: () => new Date(now) };
    const id = GroupInvitationIdFactory.create('invitation-1');
    const inviteeId = GroupMemberIdFactory.create('member-invitee');
    const invitation = GroupInvitation.create(
      {
        id,
        inviterId: GroupMemberIdFactory.create('member-inviter'),
        inviteeId,
        groupId: ExpenseGroupIdFactory.create('group-1'),
        expiresAt,
      },
      clock as any,
    );

    invitation.pullDomainEvents();
    return { invitation, inviteeId, clock };
  }

  test.each([
    [GroupInvitationStatus.ACCEPTED, GroupInvitationAcceptedType],
    [GroupInvitationStatus.REJECTED, GroupInvitationRejectedType],
  ] as const)('records the %s decision and its domain event', (decision, eventType) => {
    const { invitation, inviteeId, clock } = setup();

    invitation.decide(decision as GroupInvitationDecision, inviteeId, clock as any);

    expect(invitation.status).toBe(decision);
    expect(invitation.pullDomainEvents()).toEqual([
      expect.objectContaining({
        type: eventType,
        aggregateId: invitation.id,
        occuredAt: now,
      }),
    ]);
  });

  test('rejects a decision at the expiry instant without changing the invitation', () => {
    const { invitation, inviteeId, clock } = setup(now);

    expect(() => invitation.decide(GroupInvitationStatus.ACCEPTED, inviteeId, clock as any)).toThrow();
    expect(invitation.status).toBe(GroupInvitationStatus.PENDING);
    expect(invitation.pullDomainEvents()).toEqual([]);
  });

  test('only the invited member can decide an invitation', () => {
    const { invitation, clock } = setup();

    expect(() =>
      invitation.decide(
        GroupInvitationStatus.ACCEPTED,
        GroupMemberIdFactory.create('another-member'),
        clock as any,
      ),
    ).toThrow();
    expect(invitation.status).toBe(GroupInvitationStatus.PENDING);
    expect(invitation.pullDomainEvents()).toEqual([]);
  });

  test('does not allow a second decision after the invitation has been decided', () => {
    const { invitation, inviteeId, clock } = setup();
    invitation.decide(GroupInvitationStatus.ACCEPTED, inviteeId, clock as any);
    invitation.pullDomainEvents();

    expect(() => invitation.decide(GroupInvitationStatus.REJECTED, inviteeId, clock as any)).toThrow();
    expect(invitation.status).toBe(GroupInvitationStatus.ACCEPTED);
    expect(invitation.pullDomainEvents()).toEqual([]);
  });

  test('expires a pending invitation and emits one expiry event', () => {
    const { invitation, clock } = setup();

    invitation.expire(clock as any);

    expect(invitation.status).toBe(GroupInvitationStatus.EXPIRED);
    expect(invitation.pullDomainEvents()).toEqual([
      expect.objectContaining({
        type: GroupInvitationExpiredType,
        aggregateId: invitation.id,
        occuredAt: now,
      }),
    ]);
  });

  test('does not expire an invitation more than once', () => {
    const { invitation, clock } = setup();
    invitation.expire(clock as any);
    invitation.pullDomainEvents();

    expect(() => invitation.expire(clock as any)).toThrow();
    expect(invitation.status).toBe(GroupInvitationStatus.EXPIRED);
    expect(invitation.pullDomainEvents()).toEqual([]);
  });
});
