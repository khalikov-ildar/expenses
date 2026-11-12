import { createHash } from 'node:crypto';
import { OAuthTransactionPurposes } from '../oauth/oauth-transaction.js';
import { OAuthTransactionService } from './oauth-transaction.service.js';

describe('OAuthTransactionService', () => {
  const now = new Date('2026-11-12T10:00:00.000Z');
  const stateTtl = 10 * 60 * 1_000;
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');

  function setup(consumed: unknown = { id: 'transaction-1', purpose: 'login', codeVerifier: 'verifier' }) {
    const repository = {
      create: vitest.fn().mockResolvedValue(undefined),
      consume: vitest.fn().mockResolvedValue(consumed),
    };
    const clock = { after: (duration: number) => new Date(now.getTime() + duration) };
    const service = new OAuthTransactionService(
      repository as any,
      { oauthStateTtl: stateTtl } as any,
      clock as any,
    );

    return { service, repository };
  }

  test('starts a browser-bound PKCE transaction with hashed state and a bounded expiry', async () => {
    const { service, repository } = setup();

    const started = await service.start({
      provider: 'google' as any,
      purpose: OAuthTransactionPurposes.login,
      userId: null,
    });

    const [persisted] = repository.create.mock.calls[0] as any[];

    expect(started.state).toBeTruthy();
    expect(started.browserBinding).toBeTruthy();
    expect(started.codeChallenge).toBe(
      createHash('sha256').update(persisted.codeVerifier).digest('base64url'),
    );
    expect(persisted).toMatchObject({
      provider: 'google',
      purpose: 'login',
      userId: null,
      expiresAt: new Date(now.getTime() + stateTtl),
      stateHash: hash(started.state),
      browserBindingHash: hash(started.browserBinding),
    });
    expect(persisted.stateHash).not.toBe(started.state);
    expect(persisted.browserBindingHash).not.toBe(started.browserBinding);
  });

  test('creates independent state and browser bindings for separate authorization attempts', async () => {
    const { service } = setup();

    const first = await service.start({
      provider: 'google' as any,
      purpose: OAuthTransactionPurposes.login,
      userId: null,
    });
    const second = await service.start({
      provider: 'github' as any,
      purpose: OAuthTransactionPurposes.login,
      userId: null,
    });

    expect(second.state).not.toBe(first.state);
    expect(second.browserBinding).not.toBe(first.browserBinding);
    expect(second.codeChallenge).not.toBe(first.codeChallenge);
  });

  test('consumes a transaction using hashes of the supplied state and browser binding', async () => {
    const consumed = {
      id: 'transaction-1',
      provider: 'google',
      purpose: 'login',
      stateHash: hash('state'),
      browserBindingHash: hash('binding'),
      codeVerifier: 'stored-verifier',
      userId: null,
      expiresAt: new Date(now.getTime() + stateTtl),
      consumedAt: now,
    };
    const { service, repository } = setup(consumed);

    await expect(
      service.consume({
        provider: 'google' as any,
        state: 'state',
        browserBinding: 'binding',
        now,
      }),
    ).resolves.toBe(consumed);

    expect(repository.consume).toHaveBeenCalledWith({
      provider: 'google',
      stateHash: hash('state'),
      browserBindingHash: hash('binding'),
      now,
    });
  });

  test('rejects a transaction that the repository cannot consume', async () => {
    const { service } = setup(null);

    await expect(
      service.consume({
        provider: 'google' as any,
        state: 'unknown-state',
        browserBinding: 'browser-binding',
        now,
      }),
    ).rejects.toThrow();
  });
});
