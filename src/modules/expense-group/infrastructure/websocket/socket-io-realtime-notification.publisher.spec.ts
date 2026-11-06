import { SocketIoRealtimeNotificationPublisher } from './socket-io-realtime-notification.publisher.js';

describe('SocketIoRealtimeNotificationPublisher', () => {
  test('adapts the application port to the authenticated gateway room emitter', () => {
    const gateway = { emitToUser: vitest.fn() };
    const publisher = new SocketIoRealtimeNotificationPublisher(gateway as never);
    const notification = {
      id: 'event-1',
      type: 'group.invitation.created' as const,
      occurredAt: '2026-11-06T12:00:00.000Z',
      data: { invitationId: 'invitation-1' },
    };

    publisher.notifyUser('user-1' as never, notification);

    expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', notification);
  });
});
