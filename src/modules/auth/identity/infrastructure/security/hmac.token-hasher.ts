import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { TokenHasher } from '@/modules/auth/identity/application/ports/token-hasher.js';
import { AppConfig, RefreshTokenConfig } from '@/shared/infrastructure/config/env.schema.js';

@Injectable()
export class HmacSha256TokenHasher implements TokenHasher {
  private readonly secret: Buffer;

  constructor(cfg: RefreshTokenConfig) {
    this.secret = Buffer.from(cfg.refreshHashSecret, 'utf8');
  }

  hashToken(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }

  compare(token: string, hashedToken: string): boolean {
    const computed = Buffer.from(this.hashToken(token), 'hex');
    const stored = Buffer.from(hashedToken, 'hex');

    if (computed.length !== stored.length) return false;

    return timingSafeEqual(computed, stored);
  }
}
