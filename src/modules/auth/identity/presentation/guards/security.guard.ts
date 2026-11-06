import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SECURITY_METADATA, SecurityOptions } from '../types/security.js';
import { AuthTypes } from '../types/auth-type.js';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard.js';
import { RequestIntegrityService } from '@/modules/auth/identity/application/ports/request-integrity.service.js';
import type { Request } from 'express';
import { CsrfHeaderName } from '../types/csrf.js';
import { RequestIntegrityStorage } from '../../infrastructure/security/request-integrity.storage.js';

@Injectable()
export class SecurityGuard implements CanActivate {
  private static readonly defaultOptions: SecurityOptions = {
    auth: AuthTypes.BEARER,
    csrf: false,
  };

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtGuard: JwtGuard,
    private readonly integrity: RequestIntegrityService,
    private readonly integrityStorage: RequestIntegrityStorage,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.getOptions(ctx);

    await this.handleAuth(ctx, options);
    this.handleIntegrity(ctx, options);

    return true;
  }

  private getOptions(ctx: ExecutionContext): SecurityOptions {
    return (
      this.reflector.getAllAndOverride<SecurityOptions>(SECURITY_METADATA, [ctx.getHandler(), ctx.getClass()]) ??
      SecurityGuard.defaultOptions
    );
  }

  private async handleAuth(ctx: ExecutionContext, options: SecurityOptions): Promise<void> {
    switch (options.auth) {
      case AuthTypes.NONE:
        return;
      case AuthTypes.BEARER:
        await this.jwtGuard.canActivate(ctx, 'access');
        return;
      case AuthTypes.COOKIE:
        await this.jwtGuard.canActivate(ctx, 'refresh');
        return;
    }
  }

  private handleIntegrity(ctx: ExecutionContext, options: SecurityOptions): void {
    if (!options.csrf) return;

    const req = ctx.switchToHttp().getRequest<Request>();
    this.validateCsrf(req);
  }

  private validateCsrf(req: Request): void {
    const cookieToken = this.integrityStorage.getCsrfToken(req);
    const headerToken = req.headers[CsrfHeaderName];

    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
      throw new UnauthorizedException('Missing CSRF token');
    }

    if (!this.integrity.isCsrfTokenValid(headerToken, cookieToken)) {
      throw new UnauthorizedException('Invalid CSRF token');
    }
  }
}
