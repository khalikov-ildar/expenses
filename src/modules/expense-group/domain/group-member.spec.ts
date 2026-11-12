import type { Clock } from '@/shared/domain/clock.js';
import { ExpenseGroupIdFactory } from './expense-group.js';
import {
  ExpenseGroupMember,
  GroupMemberIdFactory,
  GroupMemberStatus,
} from './group-member.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { GroupInvitationStatus } from './group-invitation.js';

describe('ExpenseGroupMember', () => {
  const now = new Date('2026-11-12T10:00:00.000Z');
  const clock = {
    now: () => new Date(now),
    nowInMs: () => now.getTime(),
    fromMs: (ms: number) => new Date(ms),
    after: (ms: number) => new Date(now.getTime() + ms),
  } satisfies Clock;

  function createActiveMember() {
    const id = GroupMemberIdFactory.create('member-1');
    const member = ExpenseGroupMember.createActive(
      id,
      AuthUserIdFactory.create('user-1'),
      ExpenseGroupIdFactory.create('group-1'),
      now,
    );
    return { member, id };
  }

  test('exposes its identity and records a leave event when an active member leaves', () => {
    const { member, id } = createActiveMember();

    member.leave(clock);

    expect(member.id).toBe(id);
    expect(member.status).toBe(GroupMemberStatus.LEFT);
    expect(member.endedAt).toEqual(now);
    expect(member.pullDomainEvents()).toEqual([
      expect.objectContaining({
        type: 'group-member.left',
        aggregateId: id,
        payload: { groupId: member.groupId, identityId: member.identityId },
        occuredAt: now,
      }),
    ]);
  });

  test('does not allow a member to leave a group twice', () => {
    const member = createActiveMember().member;
    member.leave(clock);
    member.pullDomainEvents();

    expect(() => member.leave(clock)).toThrow();
    expect(member.status).toBe(GroupMemberStatus.LEFT);
    expect(member.pullDomainEvents()).toEqual([]);
  });

  test('activates an invited membership when its invitation is accepted', () => {
    const member = ExpenseGroupMember.createInvited(
      GroupMemberIdFactory.create('member-invited'),
      AuthUserIdFactory.create('user-invited'),
      ExpenseGroupIdFactory.create('group-1'),
    );

    member.decideInvitation(GroupInvitationStatus.ACCEPTED, clock);

    expect(member.status).toBe(GroupMemberStatus.ACTIVE);
    expect(member.joinedAt).toEqual(now);
    expect(member.endedAt).toBeNull();
  });

  test('ends an invited membership when its invitation is rejected', () => {
    const member = ExpenseGroupMember.createInvited(
      GroupMemberIdFactory.create('member-invited'),
      AuthUserIdFactory.create('user-invited'),
      ExpenseGroupIdFactory.create('group-1'),
    );

    member.decideInvitation(GroupInvitationStatus.REJECTED, clock);

    expect(member.status).toBe(GroupMemberStatus.DECLINED);
    expect(member.joinedAt).toBeNull();
    expect(member.endedAt).toEqual(now);
  });

  test('expires only an invited membership', () => {
    const invited = ExpenseGroupMember.createInvited(
      GroupMemberIdFactory.create('member-invited'),
      AuthUserIdFactory.create('user-invited'),
      ExpenseGroupIdFactory.create('group-1'),
    );
    invited.expireInvitation(clock);

    expect(invited.status).toBe(GroupMemberStatus.EXPIRED);
    expect(invited.endedAt).toEqual(now);
    expect(() => invited.expireInvitation(clock)).toThrow();

    const active = createActiveMember().member;
    expect(() => active.expireInvitation(clock)).toThrow();
    expect(active.status).toBe(GroupMemberStatus.ACTIVE);
  });
});
