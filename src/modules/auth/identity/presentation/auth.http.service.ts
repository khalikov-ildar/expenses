import { Clock } from '@/shared/domain/clock.js';
import { Injectable } from '@nestjs/common';
import { RequestIntegrityService } from '../application/ports/request-integrity.service.js';
import { RequestIntegrityStorage } from '../infrastructure/security/request-integrity.storage.js';
import {
  AppConfig,
  AuthCookieConfig,
  OAuthConfig,
  RefreshTokenConfig,
} from '@/shared/infrastructure/config/env.schema.js';
import type { Response, Request } from 'express';
import { RefreshTokenKey } from './types/refresh-token.key.js';

const AUTH_COOKIE_PATH = '/auth';

@Injectable()
export class AuthHttpService {
  constructor(
    private readonly clock: Clock,
    private readonly cookieCfg: AuthCookieConfig,
    private readonly oauthCfg: OAuthConfig,
    private readonly refreshCfg: RefreshTokenConfig,
    private readonly requestIntegrityService: RequestIntegrityService,
    private readonly requestIntegrityStorage: RequestIntegrityStorage,
  ) {}

  setRefreshCookie(response: Response, token: string): void {
    const expires = this.clock.after(this.refreshCfg.refreshTtl);

    response.cookie(RefreshTokenKey, token, {
      httpOnly: true,
      secure: this.cookieCfg.authCookieSecure,
      sameSite: this.cookieCfg.authCookieSameSite,
      path: AUTH_COOKIE_PATH,
      expires,
    });
  }

  handleTokens(accessToken: string, refreshToken: string, response: Response): { accessToken: string } {
    this.setRefreshCookie(response, refreshToken);
    this.handleCsrf(response);
    return { accessToken };
  }

  handleLogoutCookieCleanup(res: Response): void {
    res.clearCookie(RefreshTokenKey, { path: AUTH_COOKIE_PATH });
    this.requestIntegrityStorage.clearCsrfToken(res);
  }

  setOAuthBrowserBinding(res: Response, binding: string): void {
    this.requestIntegrityStorage.setOAuthBrowserBinding(binding, this.oauthCfg.oauthStateTtl, res);
  }

  getOAuthBrowserBinding(req: Request): string | undefined {
    return this.requestIntegrityStorage.getOAuthBrowserBinding(req);
  }

  clearOAuthBrowserBinding(res: Response): void {
    this.requestIntegrityStorage.clearOAuthBrowserBinding(res);
  }

  private handleCsrf(res: Response): void {
    const csrf = this.requestIntegrityService.generateCsrfToken();
    this.requestIntegrityStorage.setCsrfToken(csrf, this.refreshCfg.refreshTtl, res);
  }
}
