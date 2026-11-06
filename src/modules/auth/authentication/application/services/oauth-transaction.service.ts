import { OAuthTransactionRepository } from '../oauth/oauth-transaction.repository.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { oauthTransactionInvalidError } from '@/modules/auth/identity/domain/errors.js';
import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { Injectable } from '@nestjs/common';
import { Clock } from '@shared/domain/clock.js';
import { AppConfig, OAuthConfig } from '@shared/infrastructure/config/env.schema.js';
import { type OAuthTransactionPurpose, OAuthTransactionPurposes } from '../oauth/oauth-transaction.js';
import { createHash, randomBytes } from 'node:crypto';

export interface StartedOAuthTransaction {
  state: string;
  codeChallenge: string;
  browserBinding: string;
  transactionId: string;
  purpose: OAuthTransactionPurpose;
}

export interface ConsumeOAuthTransactionCommand {
  provider: AuthKind;
  state: string;
  browserBinding: string;
  now: Date;
}

@Injectable()
export class OAuthTransactionService {
  constructor(
    private readonly repository: OAuthTransactionRepository,
    private readonly config: OAuthConfig,
    private readonly clock: Clock,
  ) {}

  async start(input: {
    provider: AuthKind;
    purpose: OAuthTransactionPurpose;
    userId: IdentityId | null;
    browserBinding?: string;
  }): Promise<StartedOAuthTransaction> {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const browserBinding = input.browserBinding ?? randomBytes(32).toString('base64url');
    const transactionId = randomBytes(16).toString('hex');

    await this.repository.create({
      id: transactionId,
      provider: input.provider,
      purpose: input.purpose,
      stateHash: this.hash(state),
      browserBindingHash: this.hash(browserBinding),
      codeVerifier,
      userId: input.userId,
      expiresAt: this.clock.after(this.config.oauthStateTtl),
    });

    return {
      state,
      codeChallenge,
      browserBinding,
      transactionId,
      purpose: input.purpose,
    };
  }

  async consume(input: ConsumeOAuthTransactionCommand) {
    const transaction = await this.repository.consume({
      provider: input.provider,
      stateHash: this.hash(input.state),
      browserBindingHash: this.hash(input.browserBinding),
      now: input.now,
    });

    if (!transaction) {
      throw oauthTransactionInvalidError();
    }

    return transaction;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  static readonly loginPurpose = OAuthTransactionPurposes.login;
  static readonly linkPurpose = OAuthTransactionPurposes.link;
}
