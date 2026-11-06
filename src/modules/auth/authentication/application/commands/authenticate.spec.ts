import { AuthKinds } from '@/modules/auth/identity/domain/external-identity.js';
import { AuthenticateUserHandler } from './authenticate.js';
import { AuthUser } from '@/modules/auth/identity/domain/auth-user.js';
import { Clock, DateClock } from '@/shared/domain/clock.js';

describe('AuthenticateUserHandler OAuth security', () => {
  function setup(result: any, existingUser: any = null) {
    const resolver = { resolve: vitest.fn().mockReturnValue({ authenticate: vitest.fn().mockResolvedValue(result) }) };
    const identityRepo = { find: vitest.fn().mockResolvedValue(null), save: vitest.fn() };
    const userRepo = {
      findById: vitest.fn(),
      findByEmail: vitest.fn().mockResolvedValue(existingUser),
      save: vitest.fn(),
    };
    const tx = { run: vitest.fn((work: any) => work()) };
    const issuer = { issue: vitest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const logger = {
      info: vitest.fn((...params) => {}),
      debug: vitest.fn((...params) => {}),
      warn: vitest.fn((...params) => {}),
      error: vitest.fn((...params) => {}),
    };
    const clock = new DateClock();
    return {
      handler: new AuthenticateUserHandler(
        tx as any,
        resolver as any,
        identityRepo as any,
        userRepo as any,
        issuer as any,
        clock,
        logger,
      ),
      identityRepo,
    };
  }

  test('rejects unverified email', async () => {
    const { handler } = setup({
      provider: AuthKinds.google,
      providerUserId: 'p',
      email: 'x@y.z',
      emailVerified: false,
      name: null,
    });
    await expect(handler.execute(AuthKinds.google, { code: 'c', codeVerifier: 'v' })).rejects.toMatchObject({
      name: 'DomainError',
    });
  });

  test('never auto-links by email', async () => {
    const existing = AuthUser.fromPersistence({
      id: 'u-1' as any,
      email: 'x@y.z',
      passwordHash: 'hash',
      name: 'X',
    });
    const { handler, identityRepo } = setup(
      { provider: AuthKinds.google, providerUserId: 'p', email: 'x@y.z', emailVerified: true, name: 'X' },
      existing,
    );
    await expect(handler.execute(AuthKinds.google, { code: 'c', codeVerifier: 'v' })).rejects.toMatchObject({
      name: 'DomainError',
    });
    expect(identityRepo.save).not.toHaveBeenCalled();
  });
});
