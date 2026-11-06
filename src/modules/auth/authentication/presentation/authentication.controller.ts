import { ChangePasswordApi } from './swagger/change-password.decorator.js';
import { RequestEmailVerificationApi, VerifyEmailApi } from './swagger/email-verification.decorator.js';
import { LoginApi } from './swagger/login.decorator.js';
import { LogoutApi } from './swagger/logout.decorator.js';
import { OAuthStartApi } from './swagger/oauth-start.decorator.js';
import { OAuthCallbackApi, OAuthCallbackQueryApi } from './swagger/oauth.decorator.js';
import { RegisterApi } from './swagger/register.decorator.js';
import { TokenPair } from '../../identity/application/ports/token-provider.js';
import { oauthTransactionInvalidError } from '../../identity/domain/errors.js';
import { AuthHttpService } from '../../identity/presentation/auth.http.service.js';
import { SecureEndpoint } from '../../identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '../../identity/presentation/types/auth-type.js';
import { AuthenticateUserHandler } from '../application/commands/authenticate.js';
import { ChangePasswordHandler } from '../application/commands/change-password.js';
import { LinkOAuthAccountHandler } from '../application/commands/link-oauth-account.js';
import { LoginCommandHandler } from '../application/commands/login.js';
import { LogoutCommandHandler } from '../application/commands/logout.js';
import { RegisterUserHandler } from '../application/commands/register-user.js';
import { RequestEmailVerificationHandler } from '../application/commands/request-email-verification.js';
import { VerifyEmailHandler } from '../application/commands/verify-email.js';
import { OAuthTransactionPurpose, OAuthTransactionPurposes } from '../application/oauth/oauth-transaction.js';
import { OAuthClientResolver } from '../application/services/oauth-client.resolver.js';
import { OAuthTransactionService } from '../application/services/oauth-transaction.service.js';
import { AuthApplicationContext } from '@/shared/application/ports/application-context.js';
import { Clock } from '@/shared/domain/clock.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { RateLimit } from '@/shared/infrastructure/security/rate-limit.guard.js';
import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { type OAuthRequest, oauthSchema } from './schemas/oauth.schema.js';
import type { OAuthProvider } from '../../identity/domain/external-identity.js';
import type { Request, Response } from 'express';
import { type RegisterRequest, registerSchema } from './schemas/register.schema.js';
import { type LoginRequest, loginSchema } from './schemas/login.schema.js';
import { type ChangePasswordRequest, changePasswordSchema } from './schemas/change-password.schema.js';
import {
  type RequestEmailVerificationRequest,
  requestEmailVerificationSchema,
  type VerifyEmailRequest,
  verifyEmailSchema,
} from './schemas/email-verification.schema.js';

function PassthroughRes() {
  return Res({ passthrough: true });
}

const MINUTE_MS = 60_000;

@Controller()
export class AuthenticationController {
  constructor(
    private registerHandler: RegisterUserHandler,
    private loginHandler: LoginCommandHandler,
    private logoutHandler: LogoutCommandHandler,
    private authenticateHandler: AuthenticateUserHandler,
    private linkOAuthHandler: LinkOAuthAccountHandler,
    private requestEmailVerificationHandler: RequestEmailVerificationHandler,
    private verifyEmailHandler: VerifyEmailHandler,
    private oauthClientResolver: OAuthClientResolver,
    private oauthTransactionService: OAuthTransactionService,
    private changePassword: ChangePasswordHandler,
    private context: AuthApplicationContext,
    private authHttpService: AuthHttpService,
    private clock: Clock,
  ) {}

  @Post('auth/register')
  @RateLimit({
    bucket: 'auth-register',
    limit: 3,
    windowMs: 15 * MINUTE_MS,
  })
  @RegisterApi()
  async register(@Body({ schema: registerSchema }) dto: RegisterRequest) {
    return this.registerHandler.execute(dto);
  }

  @Post('auth/login')
  @LoginApi()
  async login(@Body({ schema: loginSchema }) dto: LoginRequest, @PassthroughRes() res: Response) {
    const { accessToken, refreshToken } = await this.loginHandler.execute(dto);
    return this.authHttpService.handleTokens(accessToken, refreshToken, res);
  }

  @Post('auth/logout')
  @RateLimit({
    bucket: 'auth-login',
    limit: 8,
    windowMs: MINUTE_MS,
  })
  @LogoutApi()
  async logout(@PassthroughRes() res: Response) {
    await this.logoutHandler.execute();
    return this.authHttpService.handleLogoutCookieCleanup(res);
  }

  @Post('auth/email-verification/request')
  @RateLimit({
    bucket: 'auth-verification-request',
    limit: 3,
    windowMs: 15 * MINUTE_MS,
  })
  @RequestEmailVerificationApi()
  async requestEmailVerification(
    @Body({ schema: requestEmailVerificationSchema }) dto: RequestEmailVerificationRequest,
  ) {
    await this.requestEmailVerificationHandler.execute(dto);
  }

  @Post('auth/email-verification/verify')
  @RateLimit({
    bucket: 'auth-verification-consume',
    limit: 10,
    windowMs: 5 * MINUTE_MS,
  })
  @VerifyEmailApi()
  async verifyEmail(@Body({ schema: verifyEmailSchema }) dto: VerifyEmailRequest) {
    await this.verifyEmailHandler.execute(dto);
  }

  @Get('auth/oauth/:provider/start')
  @RateLimit({
    bucket: 'auth-oauth-start',
    limit: 10,
    windowMs: 5 * MINUTE_MS,
  })
  @OAuthStartApi()
  async oauthStart(@Param('provider') provider: OAuthProvider, @Req() req: Request, @PassthroughRes() res: Response) {
    return this.startOAuth(provider, OAuthTransactionPurposes.login, null, req, res);
  }

  @Get('auth/oauth/:provider/link/start')
  @SecureEndpoint({ auth: AuthTypes.BEARER })
  async oauthLinkStart(
    @Param('provider') provider: OAuthProvider,
    @Req() req: Request,
    @PassthroughRes() res: Response,
  ) {
    const userId = this.context.userId;
    return this.startOAuth(provider, OAuthTransactionPurposes.link, userId, req, res);
  }

  @Get('auth/oauth/:provider/callback')
  @OAuthCallbackQueryApi()
  async oauthCallbackGet(
    @Param('provider') provider: OAuthProvider,
    @Query({ schema: oauthSchema }) dto: OAuthRequest,
    @Req() req: Request,
    @PassthroughRes() res: Response,
  ) {
    return this.handleOAuthCallback(provider, dto, req, res);
  }

  @Post('auth/oauth/:provider/callback')
  @OAuthCallbackApi()
  async oauthCallbackPost(
    @Param('provider') provider: OAuthProvider,
    @Body({ schema: oauthSchema }) dto: OAuthRequest,
    @Req() req: Request,
    @PassthroughRes() res: Response,
  ) {
    return this.handleOAuthCallback(provider, dto, req, res);
  }

  @Post('auth/change-password')
  @ChangePasswordApi()
  async change(@Body({ schema: changePasswordSchema }) dto: ChangePasswordRequest) {
    return this.changePassword.execute(dto);
  }

  private async startOAuth(
    provider: OAuthProvider,
    purpose: OAuthTransactionPurpose,
    userId: IdentityId | null,
    req: Request,
    res: Response,
  ) {
    const client = this.oauthClientResolver.resolve(provider);
    const transaction = await this.oauthTransactionService.start({
      provider,
      purpose,
      userId,
      browserBinding: this.authHttpService.getOAuthBrowserBinding(req),
    });

    this.authHttpService.setOAuthBrowserBinding(res, transaction.browserBinding);

    return {
      authUrl: client.getAuthorizationUrl({ state: transaction.state, codeChallenge: transaction.codeChallenge }),
    };
  }

  private async handleOAuthCallback(provider: OAuthProvider, dto: OAuthRequest, req: Request, res: Response) {
    let tokenPair: TokenPair;

    try {
      const browserBinding = this.authHttpService.getOAuthBrowserBinding(req);
      if (!browserBinding) {
        throw oauthTransactionInvalidError();
      }

      const transaction = await this.oauthTransactionService.consume({
        provider,
        state: dto.state,
        browserBinding,
        now: this.clock.now(),
      });

      if (transaction.purpose === OAuthTransactionPurposes.link) {
        if (!transaction.userId) throw oauthTransactionInvalidError();
        tokenPair = await this.linkOAuthHandler.execute({
          provider,
          code: dto.code,
          codeVerifier: transaction.codeVerifier,
          userId: transaction.userId,
        });
      } else {
        tokenPair = await this.authenticateHandler.execute(provider, {
          code: dto.code,
          codeVerifier: transaction.codeVerifier,
        });
      }
    } finally {
      this.authHttpService.clearOAuthBrowserBinding(res);
    }

    return this.authHttpService.handleTokens(tokenPair.accessToken, tokenPair.refreshToken, res);
  }
}
