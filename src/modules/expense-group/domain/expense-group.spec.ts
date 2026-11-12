import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { Currency } from './currency.js';
import { ExpenseGroup, ExpenseGroupIdFactory, ExpenseGroupStatus } from './expense-group.js';

describe('ExpenseGroup', () => {
  function createGroup() {
    return ExpenseGroup.create(
      ExpenseGroupIdFactory.create('group-1'),
      'Weekend trip',
      AuthUserIdFactory.create('user-1'),
      Currency.create('EUR'),
    );
  }

  test('starts in pending state and becomes active when activated', () => {
    const group = createGroup();

    expect(group.status).toBe(ExpenseGroupStatus.PENDING);

    group.activate();

    expect(group.status).toBe(ExpenseGroupStatus.ACTIVE);
  });

  test('a pending group can be cancelled', () => {
    const group = createGroup();

    group.cancel();

    expect(group.status).toBe(ExpenseGroupStatus.CANCELLED);
  });

  test('does not allow a terminal group to be activated or cancelled again', () => {
    const activeGroup = createGroup();
    activeGroup.activate();

    expect(() => activeGroup.activate()).toThrow();
    expect(() => activeGroup.cancel()).toThrow();

    const cancelledGroup = createGroup();
    cancelledGroup.cancel();

    expect(() => cancelledGroup.activate()).toThrow();
    expect(() => cancelledGroup.cancel()).toThrow();
  });
});
