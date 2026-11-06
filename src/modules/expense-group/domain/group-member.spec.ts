import { DateClock } from '@/shared/domain/clock.js';
import { ExpenseGroupIdFactory } from './expense-group.js';
import { ExpenseGroupMember, GroupMemberIdFactory } from './group-member.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';

describe('ExpenseGroupMember', () => {
  test('records a group-member.left domain event when an active member leaves', () => {
    const clock = new DateClock();
    const member = ExpenseGroupMember.createActive(
      GroupMemberIdFactory.random(),
      AuthUserIdFactory.create('user-1'),
      ExpenseGroupIdFactory.random(),
      clock.now(),
    );

    member.leave(clock);

    const [event] = member.pullDomainEvents();
    expect(event).toMatchObject({
      type: 'group-member.left',
      aggregateId: member.id,
      payload: { groupId: member.groupId, identityId: member.identityId },
    });
    expect(event?.occuredAt).toBeInstanceOf(Date);
  });
});
