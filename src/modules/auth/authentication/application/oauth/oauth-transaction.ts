import { IdentityId } from '@/shared/domain/id/auth.js';
import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';

export const OAuthTransactionPurposes = {
  login: 'login',
  link: 'link',
} as const;

export type OAuthTransactionPurpose = (typeof OAuthTransactionPurposes)[keyof typeof OAuthTransactionPurposes];

export interface OAuthTransaction {
  id: string;
  provider: AuthKind;
  purpose: OAuthTransactionPurpose;
  stateHash: string;
  browserBindingHash: string;
  codeVerifier: string;
  userId: IdentityId | null;
  expiresAt: Date;
  consumedAt: Date | null;
}
