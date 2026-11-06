import { HTTP_HEADER_VALUES, HTTP_HEADERS, OAUTH_VALUES } from './oauth-protocol.js';
import { OAuthProvider } from '../../identity/domain/external-identity.js';

export interface OAuthProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  emailsUrl?: string;

  scopes: readonly string[];

  // Some providers require additional form fields for token exchange.
  tokenExtraParams?: Readonly<Record<string, string>>;

  // Extra headers for the token exchange request (beyond form-url-encoded content type).
  tokenHeaders?: Readonly<Record<string, string>>;

  // Extra headers for userinfo requests.
  userInfoHeaders?: Readonly<Record<string, string>>;

  // Extra headers for emails request (if used).
  emailsHeaders?: Readonly<Record<string, string>>;
}

export const OAUTH_PROVIDER_CONFIG = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    tokenExtraParams: {
      grant_type: OAUTH_VALUES.grantTypeAuthorizationCode,
    },
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails',
    scopes: ['read:user', 'user:email'],
    tokenHeaders: {
      [HTTP_HEADERS.accept]: HTTP_HEADER_VALUES.acceptJson,
    },
    userInfoHeaders: {
      [HTTP_HEADERS.accept]: 'application/vnd.github+json',
    },
    emailsHeaders: {
      [HTTP_HEADERS.accept]: 'application/vnd.github+json',
    },
  },
} as const satisfies Record<OAuthProvider, OAuthProviderConfig>;
