import { OAuthTransactionPurposes } from '../oauth/oauth-transaction.js';
import { OAuthTransactionService } from './oauth-transaction.service.js';

describe('OAuthTransactionService', () => {
  test('creates random state, verifier, S256 challenge and browser binding', async () => {
    const repo = { create: vitest.fn(), consume: vitest.fn() };
    const service = new OAuthTransactionService(
      repo as any,
      { auth: { oauth: { stateTtl: 600_000 } } } as any,
      { after: (ttl: number) => new Date(Date.now() + ttl) } as any,
    );
    const tx = await service.start({
      provider: 'google' as any,
      purpose: OAuthTransactionPurposes.login,
      userId: null,
    });

    expect(tx.state).toBeTruthy();
    expect(tx.codeChallenge).toBeTruthy();
    expect(tx.browserBinding).toBeTruthy();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'login',
        codeVerifier: expect.any(String),
        stateHash: expect.any(String),
        browserBindingHash: expect.any(String),
      }),
    );
    expect(repo.create.mock.calls[0][0].stateHash).not.toBe(tx.state);
    expect(repo.create.mock.calls[0][0].browserBindingHash).not.toBe(tx.browserBinding);
  });

  test('hashes state and browser binding before repository consume', async () => {
    const repo = { create: vitest.fn(), consume: vitest.fn().mockResolvedValue({ id: 'tx' }) };
    const service = new OAuthTransactionService(
      repo as any,
      { OAUTH_STATE_TTL: 600_000 } as any,
      { new: (ttl: number) => new Date(Date.now() + ttl) } as any,
    );
    await service.consume({ provider: 'google' as any, state: 'state', browserBinding: 'binding', now: new Date() });
    const call = repo.consume.mock.calls[0][0];
    expect(call.stateHash).not.toBe('state');
    expect(call.browserBindingHash).not.toBe('binding');
  });

  test('rejects invalid, expired or already-consumed transaction', async () => {
    const repo = { create: vitest.fn(), consume: vitest.fn().mockResolvedValue(null) };
    const service = new OAuthTransactionService(
      repo as any,
      { OAUTH_STATE_TTL: 600_000 } as any,
      { new: (ttl: number) => new Date(Date.now() + ttl) } as any,
    );
    await expect(
      service.consume({ provider: 'google' as any, state: 's', browserBinding: 'b', now: new Date() }),
    ).rejects.toThrow('Invalid or expired OAuth transaction');
  });
});
