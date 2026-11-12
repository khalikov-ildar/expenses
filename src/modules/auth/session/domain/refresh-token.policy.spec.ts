import { RefreshToken, RefreshTokenIdFactory } from './refresh-token.js';
import { RefreshTokenPolicy } from './refresh-token.policy.js';
import {
  RefreshTokenFamily,
  RefreshTokenFamilyIdFactory,
  RefreshTokenRevocationReasons,
} from './refresh-token-family.js';

describe('RefreshTokenPolicy', () => {
  const now = new Date('2026-09-18T00:00:00.000Z');
  const clock = { now: () => new Date(now) };

  function createFamily(expiresAt = new Date('2026-12-17T00:00:00.000Z')) {
    return RefreshTokenFamily.create(
      RefreshTokenFamilyIdFactory.random(),
      'user-1' as any,
      new Date('2026-09-17T00:00:00.000Z'),
      expiresAt,
    );
  }

  function createToken(family: RefreshTokenFamily, expiresAt = new Date('2026-10-18T00:00:00.000Z')) {
    return RefreshToken.create(RefreshTokenIdFactory.random(), family.id, 'hash', expiresAt);
  }

  test('accepts an active token in an active family', () => {
    const family = createFamily();
    const token = createToken(family);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family)).toEqual({ type: 'valid' });
  });

  test('classifies a rotated token as replay', () => {
    const family = createFamily();
    const token = createToken(family);
    token.rotate(now, RefreshTokenIdFactory.random());

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('reuse-detected');
  });

  test('classifies a revoked token that was not rotated as revoked, not as replay', () => {
    const family = createFamily();
    const token = createToken(family);
    token.revoke(now, RefreshTokenRevocationReasons.SECURITY_EVENT);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('revoked');
  });

  test('revoked family takes precedence over token state', () => {
    const family = createFamily();
    const token = createToken(family);
    family.revoke(now, RefreshTokenRevocationReasons.SECURITY_EVENT);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('family-revoked');
  });

  test('treats token expiry at the current instant as expired', () => {
    const family = createFamily();
    const token = createToken(family, now);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('expired');
  });

  test('treats family expiry at the current instant as expired', () => {
    const family = createFamily(now);
    const token = createToken(family);

    expect(new RefreshTokenPolicy(clock).validateRefreshToken(token, family).type).toBe('expired');
  });
});
