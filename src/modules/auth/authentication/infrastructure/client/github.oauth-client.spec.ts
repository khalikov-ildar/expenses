import { of } from 'rxjs';
import { GithubOAuthClient } from './github.oauth-client.js';
import { OAUTH_PROVIDER_CONFIG } from '../oauth-provider.config.js';

describe('GithubOAuthClient', () => {
  test('resolves email via /user/emails when /user returns null email', async () => {
    const envService = {
      oauthGithub: { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://app.example.com/callback' },
    } as any;
    const httpService = {
      post: vitest.fn().mockReturnValue(of({ data: { access_token: 'at', token_type: 'bearer', scope: '' } })),
      get: vitest.fn((url: string) => {
        if (url === OAUTH_PROVIDER_CONFIG.github.userInfoUrl) {
          return of({ data: { id: 123, email: null, name: 'Ada', avatar_url: null } });
        }
        if (url === OAUTH_PROVIDER_CONFIG.github.emailsUrl) {
          return of({
            data: [
              { email: 'secondary@example.com', primary: false, verified: false, visibility: null },
              { email: 'primary@example.com', primary: true, verified: true, visibility: null },
            ],
          });
        }
        throw new Error(`Unexpected GET ${url}`);
      }),
    } as any;
    const logger = {
      info: vitest.fn((...params) => {}),
      debug: vitest.fn((...params) => {}),
      warn: vitest.fn((...params) => {}),
      error: vitest.fn((...params) => {}),
    };
    const client = new GithubOAuthClient(envService, httpService, logger);
    await expect(client.exchangeCode({ code: 'code123', codeVerifier: 'verifier123' })).resolves.toEqual({
      providerUserId: '123',
      email: 'primary@example.com',
      emailVerified: true,
      name: 'Ada',
      picture: undefined,
    });
  });
});
