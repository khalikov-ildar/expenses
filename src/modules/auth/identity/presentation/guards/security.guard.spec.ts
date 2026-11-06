import { AuthTypes } from '../types/auth-type.js';
import { CsrfHeaderName } from '../types/csrf.js';
import { SecurityGuard } from './security.guard.js';

describe('SecurityGuard CSRF validation', () => {
  test('compares request header against the actual CSRF cookie', async () => {
    const jwtGuard = { canActivate: vitest.fn().mockResolvedValue(true) };
    const integrity = { isCsrfTokenValid: vitest.fn().mockReturnValue(true) };
    const storage = { getCsrfToken: vitest.fn().mockReturnValue('cookie-token') };
    const reflector = {
      getAllAndOverride: vitest.fn().mockReturnValue({ auth: AuthTypes.COOKIE, csrf: true }),
    };
    const guard = new SecurityGuard(reflector as any, jwtGuard as any, integrity as any, storage as any);
    const req = { headers: { [CsrfHeaderName]: 'header-token' }, cookies: {} };
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(integrity.isCsrfTokenValid).toHaveBeenCalledWith('header-token', 'cookie-token');
  });
});
