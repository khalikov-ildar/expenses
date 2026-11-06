import { buildAuthorizationUrl } from './oauth-http.js';

describe('OAuth PKCE security', () => {
  test('authorization request uses S256 code challenge', () => {
    const url = buildAuthorizationUrl({
      authorizationUrl: 'https://provider.test/authorize',
      clientId: 'client',
      redirectUri: 'https://app.test/callback',
      state: 'state',
      codeChallenge: 'challenge',
      scopes: ['openid'],
    });
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge')).toBe('challenge');
    expect(params.get('code_challenge_method')).toBe('S256');
  });
});
