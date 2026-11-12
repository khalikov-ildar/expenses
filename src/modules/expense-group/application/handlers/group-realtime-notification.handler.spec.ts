import { GroupRealtimeNotificationHandler } from './group-realtime-notification.handler.js';
import type { ClaimedOutboxEvent } from '@/shared/application/ports/outbox.repository.js';

describe('GroupRealtimeNotificationHandler', () => {
  const occurredAt = new Date('2026-11-06T12:00:00.000Z');
  const event = (type: string): ClaimedOutboxEvent => ({
    id: `event-${type}`,
    type,
    aggregateType: 'GroupInvitation',
    aggregateId: 'invitation-1',
    occurredAt,
    payload: {},
    attempts: 1,
  });

  const createHandler = () => {
    const invitation = {
      id: 'invitation-1',
      inviterId: 'member-inviter',
      inviteeId: 'member-invitee',
      groupId: 'group-1',
      expiresAt: new Date('2026-11-13T12:00:00.000Z'),
    };
    const members = [
      { id: 'member-inviter', identityId: 'user-inviter' },
      { id: 'member-invitee', identityId: 'user-invitee' },
    ];
    const invitationRepo = { getById: vitest.fn().mockResolvedValue(invitation) };
    const memberRepo = {
      getByIds: vitest.fn().mockResolvedValue(members),
      getById: vitest.fn().mockResolvedValue({ id: 'member-left', identityId: 'user-left', groupId: 'group-1' }),
      getActiveByGroupId: vitest.fn().mockResolvedValue(members),
    };
    const groupRepo = { getById: vitest.fn().mockResolvedValue({ id: 'group-1', name: 'Trip' }) };
    const expenseRepo = {
      getById: vitest.fn().mockResolvedValue({
        id: 'expense-1',
        groupId: 'group-1',
        createdByMemberId: 'member-inviter',
        paidByMemberId: 'member-invitee',
        description: 'Train tickets',
        originalAmount: { toDecimalString: () => '42.50', currency: { code: 'EUR' } },
        baseAmount: { toDecimalString: () => '42.50', currency: { code: 'EUR' } },
      }),
    };
    const notifications = { notifyUser: vitest.fn() };
    const logger = { info: vitest.fn(), debug: vitest.fn(), warn: vitest.fn(), error: vitest.fn() };

    const handler = new GroupRealtimeNotificationHandler(
      invitationRepo as never,
      memberRepo as never,
      groupRepo as never,
      expenseRepo as never,
      notifications as never,
      logger as never,
    );

    return { handler, invitationRepo, memberRepo, groupRepo, expenseRepo, notifications, logger };
  };

  test('notifies only the invitee when an invitation is created', async () => {
    const { handler, notifications } = createHandler();

    await handler.created(event('group-invitation.created'));

    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-invitee',
      expect.objectContaining({
        id: 'event-group-invitation.created',
        type: 'group.invitation.created',
        occurredAt: occurredAt.toISOString(),
        data: expect.objectContaining({
          invitationId: 'invitation-1',
          groupId: 'group-1',
          groupName: 'Trip',
          invitedBy: 'user-inviter',
        }),
      }),
    );
  });

  test('notifies the inviter and other active members when an invitation is accepted', async () => {
    const { handler, notifications, memberRepo } = createHandler();
    memberRepo.getActiveByGroupId.mockResolvedValue([
      { id: 'member-inviter', identityId: 'user-inviter' },
      { id: 'member-invitee', identityId: 'user-invitee' },
      { id: 'member-other', identityId: 'user-other' },
      { id: 'member-other-copy', identityId: 'user-other' },
    ]);

    await handler.accepted(event('group-invitation.accepted'));

    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-inviter',
      expect.objectContaining({
        type: 'group.invitation.accepted',
        data: expect.objectContaining({ decidedBy: 'user-invitee' }),
      }),
    );
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-other',
      expect.objectContaining({
        type: 'group.member.joined',
        data: expect.objectContaining({
          groupId: 'group-1',
          memberId: 'member-invitee',
          userId: 'user-invitee',
        }),
      }),
    );
    // Duplicate active memberships for one identity produce one join event;
    // the inviter already receives the invitation decision notification.
    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
  });

  test('notifies only the inviter when an invitation is rejected', async () => {
    const { handler, notifications, memberRepo } = createHandler();

    await handler.rejected(event('group-invitation.rejected'));

    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-inviter',
      expect.objectContaining({
        type: 'group.invitation.rejected',
        data: expect.objectContaining({ decidedBy: 'user-invitee' }),
      }),
    );
  });

  test('notifies both parties when an invitation expires', async () => {
    const { handler, notifications } = createHandler();

    await handler.expired(event('group-invitation.expired'));

    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-inviter',
      expect.objectContaining({ type: 'group.invitation.expired' }),
    );
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-invitee',
      expect.objectContaining({ type: 'group.invitation.expired' }),
    );
  });


  test('notifies other active group members when a member leaves', async () => {
    const { handler, memberRepo, notifications } = createHandler();
    memberRepo.getActiveByGroupId.mockResolvedValue([
      { id: 'member-inviter', identityId: 'user-inviter' },
      { id: 'member-another', identityId: 'user-another' },
    ]);
    const leftEvent = { ...event('group-member.left'), aggregateId: 'member-left' };

    await handler.memberLeft(leftEvent);

    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-inviter',
      expect.objectContaining({ type: 'group.member.left', data: expect.objectContaining({ userId: 'user-left' }) }),
    );
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-another',
      expect.objectContaining({ type: 'group.member.left' }),
    );
  });

  test('notifies other active group members when an expense is created', async () => {
    const { handler, expenseRepo, memberRepo, notifications } = createHandler();
    memberRepo.getActiveByGroupId.mockResolvedValue([
      { id: 'member-inviter', identityId: 'user-inviter' },
      { id: 'member-invitee', identityId: 'user-invitee' },
      // Duplicate sessions/records for an identity receive one logical push.
      { id: 'member-invitee-2', identityId: 'user-invitee' },
    ]);

    await handler.expenseCreated(event('expense-group.expense.created'));

    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'user-invitee',
      expect.objectContaining({
        id: 'event-expense-group.expense.created',
        type: 'group.expense.created',
        occurredAt: occurredAt.toISOString(),
        data: expect.objectContaining({
          expenseId: 'expense-1',
          groupId: 'group-1',
          description: 'Train tickets',
          amount: '42.50',
          currency: 'EUR',
          createdBy: 'user-inviter',
          paidBy: 'user-invitee',
        }),
      }),
    );
  });

  test('fails the job if an invitation participant is missing so BullMQ can retry it', async () => {
    const { handler, memberRepo, notifications } = createHandler();
    memberRepo.getByIds.mockResolvedValue([{ id: 'member-inviter', identityId: 'user-inviter' }] as never);

    await expect(handler.created(event('group-invitation.created'))).rejects.toThrow();
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });
});
