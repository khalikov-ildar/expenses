import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';

export interface OAuthProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export abstract class ExternalOAuthClient {
  abstract provider: AuthKind;
  abstract exchangeCode(input: { code: string; codeVerifier: string }): Promise<OAuthProfile>;
  abstract getAuthorizationUrl(input: { state: string; codeChallenge: string }): string;
}
