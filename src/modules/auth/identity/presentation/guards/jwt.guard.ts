import { RefreshTokenKey } from '../types/refresh-token.key.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { AlsApplicationContextAccessor } from '@/shared/infrastructure/context/als.application-context.js';
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenProvider,
} from '@/modules/auth/identity/application/ports/token-provider.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { DomainError } from '@/shared/domain/domain-error.js';

export type JwtStrategy = 'access' | 'refresh';

@Injectable()
export class JwtGuard {
  constructor(
    private readonly als: AlsApplicationContextAccessor,
    private readonly tokenProvider: TokenProvider,
    private readonly logger: ApplicationLogger,
  ) {}

  async canActivate(ctx: ExecutionContext, strategy: JwtStrategy): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request, strategy);

    if (!token) {
      this.logger.debug('auth.token.missing', { tokenType: strategy });
      throw new UnauthorizedException('No token provided');
    }

    try {
      const tokenPayload = await this.verifyTokenPayload(token, strategy);
      this.verifyPayload(tokenPayload, strategy);
      this.populateAls(tokenPayload, token, strategy);
      return true;
    } catch (error) {
      this.logger.debug('auth.token.invalid', {
        tokenType: strategy,
        failureReason: classifyTokenError(error),
      });
      throw new UnauthorizedException('Provided token is invalid or expired');
    }
  }

  private extractToken(req: Request, strategy: JwtStrategy): string | undefined {
    if (strategy === 'access') {
      return this.extractTokenFromHeader(req);
    }

    return req.cookies?.[RefreshTokenKey];
  }

  private extractTokenFromHeader(req: Request): string | undefined {
    const authorization = req.headers.authorization;
    if (!authorization) return undefined;

    const [scheme, token, ...rest] = authorization.split(' ');
    if (rest.length > 0 || !token || scheme?.toLowerCase() !== 'bearer') {
      return undefined;
    }

    return token;
  }

  private verifyTokenPayload(token: string, strategy: JwtStrategy): Promise<AccessTokenPayload | RefreshTokenPayload> {
    return strategy === 'access'
      ? this.tokenProvider.verifyAccessToken(token)
      : this.tokenProvider.verifyRefreshToken(token);
  }

  private verifyPayload(payload: AccessTokenPayload | RefreshTokenPayload, strategy: JwtStrategy): void {
    if (!payload?.sub || !payload?.jti) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (strategy === 'access' && payload.tokenUse !== 'access') {
      throw new UnauthorizedException('Invalid access token payload');
    }

    if (strategy === 'refresh' && (payload.tokenUse !== 'refresh' || !payload.familyId)) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
  }

  private populateAls(
    payload: AccessTokenPayload | RefreshTokenPayload,
    rawToken: string,
    strategy: JwtStrategy,
  ): void {
    this.als.setValue('userId', AuthUserIdFactory.create(payload.sub)).setValue('jti', payload.jti);

    if (strategy === 'refresh') {
      this.als.setValue('refreshToken', rawToken).setValue('familyId', (payload as RefreshTokenPayload).familyId);
    }
  }
}

function classifyTokenError(error: unknown): string {
  if (error instanceof DomainError && (error as DomainError).code === 'invalid_token_payload') return 'payload';
  if (error instanceof Error) {
    if (error.name === 'TokenExpiredError') return 'expired';
    if (error.name === 'JsonWebTokenError') return 'signature_or_format';
  }
  return 'invalid';
}
