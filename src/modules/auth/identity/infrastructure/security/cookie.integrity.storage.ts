import { Injectable } from '@nestjs/common';
import { RequestIntegrityStorage } from './request-integrity.storage.js';
import type { Response, Request } from 'express';
import { AppConfig, AuthCookieConfig } from '@/shared/infrastructure/config/env.schema.js';

export const csrfCookieToken = 'csrf_token';
export const oauthBrowserBindingCookieToken = 'oauth_binding';

const AUTH_COOKIE_PATH = '/auth';

@Injectable()
export class CookieIntegrityStorage implements RequestIntegrityStorage {
  constructor(private readonly cfg: AuthCookieConfig) {}

  setCsrfToken(token: string, ttl: number, res: Response): void {
    res.cookie(csrfCookieToken, token, {
      httpOnly: false,
      secure: this.cfg.authCookieSecure,
      sameSite: this.cfg.authCookieSameSite,
      maxAge: ttl,
      path: AUTH_COOKIE_PATH,
    });
  }

  getCsrfToken(req: Request): string | undefined {
    return req.cookies?.[csrfCookieToken];
  }

  setOAuthBrowserBinding(binding: string, ttl: number, res: Response): void {
    res.cookie(oauthBrowserBindingCookieToken, binding, {
      httpOnly: true,
      secure: this.cfg.authCookieSecure,
      sameSite: 'lax',
      maxAge: ttl,
      path: AUTH_COOKIE_PATH,
    });
  }

  getOAuthBrowserBinding(req: Request): string | undefined {
    return req.cookies?.[oauthBrowserBindingCookieToken];
  }

  clearOAuthBrowserBinding(res: Response): void {
    res.clearCookie(oauthBrowserBindingCookieToken, { path: AUTH_COOKIE_PATH });
  }

  clearCsrfToken(res: Response): void {
    res.clearCookie(csrfCookieToken, { path: AUTH_COOKIE_PATH });
  }
}
