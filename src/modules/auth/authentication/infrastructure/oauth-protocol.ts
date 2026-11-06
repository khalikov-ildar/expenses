export const OAUTH_QUERY = {
  clientId: 'client_id',
  clientSecret: 'client_secret',
  redirectUri: 'redirect_uri',
  responseType: 'response_type',
  scope: 'scope',
  state: 'state',
  code: 'code',
  grantType: 'grant_type',
  codeChallenge: 'code_challenge',
  codeChallengeMethod: 'code_challenge_method',
  codeVerifier: 'code_verifier',
} as const;

export const OAUTH_VALUES = {
  responseTypeCode: 'code',
  grantTypeAuthorizationCode: 'authorization_code',
  codeChallengeMethodS256: 'S256',
} as const;

export const HTTP_HEADERS = {
  accept: 'Accept',
  authorization: 'Authorization',
  contentType: 'Content-Type',
} as const;

export const HTTP_HEADER_VALUES = {
  formUrlEncoded: 'application/x-www-form-urlencoded',
  acceptJson: 'application/json',
} as const;

export function bearer(accessToken: string): string {
  return `Bearer ${accessToken}`;
}
