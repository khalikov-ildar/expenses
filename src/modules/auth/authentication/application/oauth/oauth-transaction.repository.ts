import { OAuthTransaction, OAuthTransactionPurpose } from './oauth-transaction.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';

export interface CreateOAuthTransactionInput {
  id: string;
  provider: AuthKind;
  purpose: OAuthTransactionPurpose;
  stateHash: string;
  browserBindingHash: string;
  codeVerifier: string;
  userId: IdentityId | null;
  expiresAt: Date;
}

export interface ConsumeOAuthTransactionInput {
  provider: AuthKind;
  stateHash: string;
  browserBindingHash: string;
  now: Date;
}

export abstract class OAuthTransactionRepository {
  abstract create(input: CreateOAuthTransactionInput): Promise<void>;

  /** Atomically consumes a valid, unexpired transaction exactly once. */
  abstract consume(input: ConsumeOAuthTransactionInput): Promise<OAuthTransaction | null>;
}
