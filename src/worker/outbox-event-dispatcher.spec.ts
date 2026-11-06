import { ApplicationOutboxEventDispatcher } from './outbox-event-dispatcher.js';
import type { ClaimedOutboxEvent } from '@/shared/application/ports/outbox.repository.js';

describe('ApplicationOutboxEventDispatcher', () => {
  const event = (type: string): ClaimedOutboxEvent => ({
    id: `event-${type}`,
    type,
    aggregateType: 'Aggregate',
    aggregateId: 'aggregate-1',
    occurredAt: new Date('2026-11-06T12:00:00.000Z'),
    payload: {},
    attempts: 1,
  });

  const setup = () => {
    const groupNotifications = {
      created: vitest.fn().mockResolvedValue(undefined),
      accepted: vitest.fn().mockResolvedValue(undefined),
      rejected: vitest.fn().mockResolvedValue(undefined),
      expired: vitest.fn().mockResolvedValue(undefined),
      memberLeft: vitest.fn().mockResolvedValue(undefined),
      expenseCreated: vitest.fn().mockResolvedValue(undefined),
    };
    const logger = { info: vitest.fn(), warn: vitest.fn() };
    return {
      dispatcher: new ApplicationOutboxEventDispatcher(groupNotifications as never, logger as never),
      groupNotifications,
      logger,
    };
  };

  test.each([
    ['group-invitation.created', 'created'],
    ['group-invitation.accepted', 'accepted'],
    ['group-invitation.rejected', 'rejected'],
    ['group-invitation.expired', 'expired'],
    ['group-member.left', 'memberLeft'],
    ['expense-group.expense.created', 'expenseCreated'],
  ] as const)('routes %s to its application handler', async (type, method) => {
    const { dispatcher, groupNotifications } = setup();

    await dispatcher.dispatch(event(type));

    expect(groupNotifications[method]).toHaveBeenCalledWith(expect.objectContaining({ type }));
  });

  test('explicitly handles the user registration event', async () => {
    const { dispatcher, logger } = setup();

    await dispatcher.dispatch(event('auth-user.registered'));

    expect(logger.info).toHaveBeenCalledWith('auth.user.registered', {
      user_id: 'aggregate-1',
      event_id: 'event-auth-user.registered',
    });
  });

  test('fails unknown events so the worker can retry and eventually dead-letter them', async () => {
    const { dispatcher, logger } = setup();

    await expect(dispatcher.dispatch(event('unhandled.event'))).rejects.toThrow('Unhandled outbox event type');
    expect(logger.warn).toHaveBeenCalled();
  });
});
