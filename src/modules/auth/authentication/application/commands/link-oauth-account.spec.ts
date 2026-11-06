import { LinkOAuthAccountHandler } from './link-oauth-account.js';

describe('LinkOAuthAccountHandler', () => {
  const identity = (verified: boolean) => ({
    provider: 'google',
    providerUserId: 'p-1',
    email: 'user@example.com',
    emailVerified: verified,
    name: 'User',
  });
  function setup(value: any) {
    const strategy = { authenticate: vitest.fn().mockResolvedValue(value) };
    const resolver = { resolve: vitest.fn().mockReturnValue(strategy) };
    const identityRepo = { find: vitest.fn().mockResolvedValue(null), save: vitest.fn() };
    const userRepo = { findById: vitest.fn().mockResolvedValue({ id: 'u-1' }) };
    const tokenIssuer = { issue: vitest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const tx = { run: vitest.fn((work: any) => work()) };
    const logger = {
      info: vitest.fn((...params) => {}),
      debug: vitest.fn((...params) => {}),
      warn: vitest.fn((...params) => {}),
      error: vitest.fn((...params) => {}),
    };
    return {
      handler: new LinkOAuthAccountHandler(
        tx as any,
        resolver as any,
        identityRepo as any,
        userRepo as any,
        tokenIssuer as any,
        logger,
      ),
      identityRepo,
    };
  }

  test('requires emailVerified=true', async () => {
    const { handler, identityRepo } = setup(identity(false));
    await expect(
      handler.execute({ provider: 'google' as any, code: 'c', codeVerifier: 'v', userId: 'u-1' as any }),
    ).rejects.toMatchObject({ name: 'DomainError' });
    expect(identityRepo.save).not.toHaveBeenCalled();
  });

  test('does not steal an OAuth identity already linked to another account', async () => {
    const { handler, identityRepo } = setup(identity(true));
    identityRepo.find.mockResolvedValue({ userId: 'other' });
    await expect(
      handler.execute({ provider: 'google' as any, code: 'c', codeVerifier: 'v', userId: 'u-1' as any }),
    ).rejects.toMatchObject({ name: 'DomainError' });
    expect(identityRepo.save).not.toHaveBeenCalled();
  });

  test('explicitly links a verified identity to the authenticated actor', async () => {
    const { handler, identityRepo } = setup(identity(true));
    await expect(
      handler.execute({ provider: 'google' as any, code: 'c', codeVerifier: 'v', userId: 'u-1' as any }),
    ).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(identityRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1' }));
  });
});
