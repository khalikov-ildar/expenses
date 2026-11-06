import { RefreshToken, RefreshTokenIdFactory } from './refresh-token.js';
import { RefreshTokenPolicy } from './refresh-token.policy.js';
import {
  RefreshTokenFamily,
  RefreshTokenFamilyIdFactory,
  RefreshTokenRevocationReasons,
} from './refresh-token-family.js';

describe('RefreshTokenPolicy', () => {
  const now = new Date('2026-09-18T00:00:00.000Z');
  const clock = { now: () => now } as any;
  const family = RefreshTokenFamily.create(
    RefreshTokenFamilyIdFactory.random(),
    'user-1' as any,
    new Date('2026-09-17T00:00:00.000Z'),
    new Date('2026-12-17T00:00:00.000Z'),
  );

  test('accepts an active token in an active family', () => {
    const token = RefreshToken.create(
      RefreshTokenIdFactory.random(),
      family.id,
      'hash',
      new Date('2026-10-18T00:00:00.000Z'),
    );

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family)).toEqual({ type: 'valid' });
  });

  test('classifies a rotated token as replay', () => {
    const token = RefreshToken.create(
      RefreshTokenIdFactory.random(),
      family.id,
      'hash',
      new Date('2026-10-18T00:00:00.000Z'),
    );
    token.rotate(now, RefreshTokenIdFactory.random());

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('reuse-detected');
  });

  test('revoked family takes precedence over token state', () => {
    const token = RefreshToken.create(
      RefreshTokenIdFactory.random(),
      family.id,
      'hash',
      new Date('2026-10-18T00:00:00.000Z'),
    );
    family.revoke(now, RefreshTokenRevocationReasons.SECURITY_EVENT);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('family-revoked');
  });
});
