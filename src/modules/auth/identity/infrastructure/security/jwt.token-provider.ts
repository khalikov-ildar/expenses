import { Injectable } from '@nestjs/common';
import {
  AccessTokenPayload,
  DecodedToken,
  JtiPair,
  RefreshTokenPayload,
  TokenPair,
  TokenPairSignPayload,
  TokenProvider,
} from '../../application/ports/token-provider.js';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenConfig, RefreshTokenConfig } from '@/shared/infrastructure/config/env.schema.js';
import { AccessTokenIdFactory } from '@/modules/auth/session/domain/access-token.id.js';
import { RefreshTokenIdFactory } from '@/modules/auth/session/domain/refresh-token.js';
import { msToSeconds } from '@/shared/domain/date.converter.js';
import { invalidTokenPayloadError } from '../../domain/errors.js';

@Injectable()
export class JwtTokenProvider implements TokenProvider {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    accessCfg: AccessTokenConfig,
    refreshCfg: RefreshTokenConfig,
  ) {
    this.accessSecret = accessCfg.accessSecret;
    this.accessTtlMs = accessCfg.accessTtl;
    this.refreshSecret = refreshCfg.refreshSecret;
    this.refreshTtlMs = refreshCfg.refreshTtl;
  }

  async signTokenPair({ accessJti, refreshJti, sub, familyId }: TokenPairSignPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken({ sub, jti: accessJti, tokenUse: 'access' }),
      this.signRefreshToken({ sub, jti: refreshJti, familyId, tokenUse: 'refresh' }),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.accessSecret,
      algorithms: ['HS256'],
    });

    if (payload.tokenUse !== 'access') {
      throw invalidTokenPayloadError();
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.refreshSecret,
      algorithms: ['HS256'],
    });

    if (payload.tokenUse !== 'refresh' || !payload.familyId) {
      throw invalidTokenPayloadError();
    }

    return payload;
  }

  decode<Decoded extends DecodedToken = DecodedToken>(token: string): Decoded | null {
    return this.jwt.decode(token) as Decoded | null;
  }

  getJtiPair(): JtiPair {
    return {
      accessJti: AccessTokenIdFactory.random(),
      refreshJti: RefreshTokenIdFactory.random(),
    };
  }

  private async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: msToSeconds(this.accessTtlMs),
      secret: this.accessSecret,
      algorithm: 'HS256',
    });
  }

  private async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: msToSeconds(this.refreshTtlMs),
      secret: this.refreshSecret,
      algorithm: 'HS256',
    });
  }
}
