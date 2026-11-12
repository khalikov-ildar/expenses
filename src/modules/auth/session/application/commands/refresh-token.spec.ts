import {
  RefreshTokenFamily,
  RefreshTokenFamilyIdFactory,
  RefreshTokenRevocationReasons,
} from '../../domain/refresh-token-family.js';
import { RefreshToken, RefreshTokenIdFactory } from '../../domain/refresh-token.js';
import { RefreshTokenHandler } from './refresh-token.js';
import { RefreshTokenPolicy } from '../../domain/refresh-token.policy.js';

describe('RefreshTokenHandler', () => {
  const now = new Date('2026-09-18T00:00:00.000Z');

  function setup() {
    const family = RefreshTokenFamily.create(
      RefreshTokenFamilyIdFactory.random(),
      'user-1' as any,
      new Date('2026-09-17T00:00:00.000Z'),
      new Date('2026-12-17T00:00:00.000Z'),
    );
    const current = RefreshToken.create(
      RefreshTokenIdFactory.random(),
      family.id,
      'hash-old',
      new Date('2026-10-18T00:00:00.000Z'),
    );

    const repo = {
      findForUpdate: vitest.fn().mockResolvedValue({ token: current, family }),
      rotate: vitest.fn(),
      revokeFamily: vitest.fn(),
      createFamily: vitest.fn(),
      revokeAllForUser: vitest.fn(),
    };
    const hasher = { compare: vitest.fn().mockReturnValue(true), hashToken: vitest.fn().mockReturnValue('hash-new') };
    const tokenProvider = {
      getJtiPair: vitest.fn().mockReturnValue({ accessJti: 'a2', refreshJti: 'r2' }),
      signTokenPair: vitest.fn().mockResolvedValue({ accessToken: 'a2-token', refreshToken: 'r2-token' }),
      decode: vitest.fn().mockReturnValue({ exp: Math.floor(new Date('2026-10-18T00:00:00.000Z').getTime() / 1000) }),
    };
    const userRepo = { findById: vitest.fn().mockResolvedValue({ id: 'user-1' }) };
    const clock = { now: () => now };
    const policy = new RefreshTokenPolicy(clock as any);
    const context = {
      userId: 'user-1',
      jti: current.id,
      refreshToken: 'raw-old',
      familyId: family.id,
    };
    const tx = { run: vitest.fn((work: any) => work()) };
    const logger = {
      info: vitest.fn((...params) => {}),
      debug: vitest.fn((...params) => {}),
      warn: vitest.fn((...params) => {}),
      error: vitest.fn((...params) => {}),
    };

    return {
      family,
      current,
      repo,
      tokenProvider,
      handler: new RefreshTokenHandler(
        clock as any,
        userRepo as any,
        repo as any,
        hasher as any,
        tokenProvider as any,
        policy as any,
        context as any,
        tx as any,
        logger,
      ),
    };
  }

  test('rotates inside the same family and increments generation', async () => {
    const { handler, repo, current, family } = setup();

    await expect(handler.execute()).resolves.toEqual({
      accessToken: 'a2-token',
      refreshToken: 'r2-token',
    });

    expect(repo.rotate).toHaveBeenCalledTimes(1);
    const [previous, replacement] = repo.rotate.mock.calls[0];
    expect(previous.id).toBe(current.id);
    expect(previous.revoked).toBe(true);
    expect(previous.revokedReason).toBe(RefreshTokenRevocationReasons.ROTATED);
    expect(replacement.familyId).toBe(family.id);
    expect(replacement.parentId).toBe(current.id);
    expect(replacement.generation).toBe(1);
  });

  test('revokes only the current family when a rotated token is replayed', async () => {
    const { handler, repo, family, current } = setup();
    current.rotate(now, RefreshTokenIdFactory.random());

    await expect(handler.execute()).rejects.toThrow();
    expect(repo.revokeFamily).toHaveBeenCalledWith(family.id, RefreshTokenRevocationReasons.REUSE_DETECTED);
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });
});
