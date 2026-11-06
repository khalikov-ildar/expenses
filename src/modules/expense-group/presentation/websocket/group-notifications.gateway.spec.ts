import { GroupNotificationsGateway } from './group-notifications.gateway.js';

describe('GroupNotificationsGateway', () => {
  const createGateway = () => {
    const tokenProvider = {
      verifyAccessToken: vitest.fn().mockResolvedValue({
        sub: 'user-1',
        jti: 'access-token-1',
        tokenUse: 'access',
      }),
    };
    const logger = { info: vitest.fn(), debug: vitest.fn(), warn: vitest.fn(), error: vitest.fn() };
    const gateway = new GroupNotificationsGateway(tokenProvider as never, logger as never);
    return { gateway, tokenProvider, logger };
  };

  test('authenticates with handshake auth and joins the server-derived user room', async () => {
    const { gateway } = createGateway();
    const middleware: Function[] = [];
    const namespace = {
      use: (fn: Function) => middleware.push(fn),
      to: vitest.fn().mockReturnValue({ emit: vitest.fn() }),
    };
    const join = vitest.fn().mockResolvedValue(undefined);
    const client = {
      handshake: { auth: { token: 'signed-access-token' }, headers: {} },
      data: {},
      join,
      disconnect: vitest.fn(),
    };

    gateway.afterInit(namespace as never);
    await new Promise<void>((resolve, reject) => middleware[0]!(client, (error?: Error) => (error ? reject(error) : resolve())));
    await gateway.handleConnection(client as never);

    expect(join).toHaveBeenCalledWith('user:user-1');
  });

  test('rejects a token with the wrong token use and never joins a room', async () => {
    const { gateway, tokenProvider } = createGateway();
    tokenProvider.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      jti: 'refresh-token-1',
      tokenUse: 'refresh',
    } as never);
    const middleware: Function[] = [];
    gateway.afterInit({ use: (fn: Function) => middleware.push(fn) } as never);
    const client = {
      handshake: { auth: { token: 'wrong-token' }, headers: {} },
      data: {},
      join: vitest.fn(),
      disconnect: vitest.fn(),
    };

    await new Promise<void>((resolve) => {
      middleware[0]!(client, (error?: Error) => {
        expect(error).toBeInstanceOf(Error);
        resolve();
      });
    });
    await gateway.handleConnection(client as never);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  test('emits only to the target user room', () => {
    const { gateway } = createGateway();
    const emit = vitest.fn();
    const to = vitest.fn().mockReturnValue({ emit });
    (gateway as unknown as { server: unknown }).server = { to };

    gateway.emitToUser('user-1' as never, {
      id: 'event-1',
      type: 'group.invitation.created',
      occurredAt: '2026-11-06T12:00:00.000Z',
      data: { invitationId: 'invitation-1' },
    });

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith('notification', expect.objectContaining({ id: 'event-1' }));
  });
});
