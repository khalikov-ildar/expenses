import { Injectable, Logger } from '@nestjs/common';
import { ExternalOAuthClient, OAuthProfile } from '../../application/services/external-oauth.client.js';
import { AuthKinds } from '../../../identity/domain/external-identity.js';
import { AppConfig, OAuthConfig } from '@/shared/infrastructure/config/env.schema.js';
import { OAUTH_PROVIDER_CONFIG, OAuthProviderConfig } from '../oauth-provider.config.js';
import { HttpService } from '@nestjs/axios';
import {
  oauthEmailNotVerifiedError,
  oauthEmailsFetchFailedError,
  oauthTokenExchangeFailedError,
  oauthUserInfoFetchFailedError,
} from '../../../identity/domain/errors.js';
import { buildAuthorizationUrl, postFormUrlEncoded } from '../oauth-http.js';
import { getHttpErrorDetails, retryOAuthRequest } from '../oauth-retry.js';
import { lastValueFrom } from 'rxjs';
import { bearer, OAUTH_QUERY } from '../oauth-protocol.js';
import { AuthClient } from '../../application/services/oauth-client.decorator.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';

interface GithubTokenResponse {
  access_token: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface GithubUserInfo {
  id: number;
  name?: string;
  avatar_url?: string;
}

interface GithubEmail {
  email: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
@AuthClient(AuthKinds.github)
export class GithubOAuthClient implements ExternalOAuthClient {
  readonly provider = AuthKinds.github;
  private readonly cfg: OAuthProviderConfig = OAUTH_PROVIDER_CONFIG.github;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    cfg: OAuthConfig,
    private readonly httpService: HttpService,
    private readonly logger: ApplicationLogger,
  ) {
    this.clientId = cfg.oauthGithub.clientId;
    this.clientSecret = cfg.oauthGithub.clientSecret;
    this.redirectUri = cfg.oauthGithub.redirectUri;
  }

  async exchangeCode(input: { code: string; codeVerifier: string }): Promise<OAuthProfile> {
    const tokens = await this.exchangeCodeForTokens(input.code, input.codeVerifier);
    const userInfo = await this.fetchUserInfo(tokens.access_token);
    const emails = await this.fetchUserEmails(tokens.access_token);
    const verified = emails.find((item) => item.primary && item.verified) ?? emails.find((item) => item.verified);

    if (!verified) {
      throw oauthEmailNotVerifiedError({ metadata: { provider: this.provider } });
    }

    return {
      providerUserId: userInfo.id.toString(),
      email: verified.email,
      emailVerified: true,
      name: userInfo.name ?? undefined,
      picture: userInfo.avatar_url ?? undefined,
    };
  }

  getAuthorizationUrl(input: { state: string; codeChallenge: string }): string {
    return buildAuthorizationUrl({
      authorizationUrl: this.cfg.authorizationUrl,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      state: input.state,
      codeChallenge: input.codeChallenge,
      scopes: this.cfg.scopes,
    });
  }

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<GithubTokenResponse> {
    try {
      return await retryOAuthRequest(
        this.logger,
        () =>
          postFormUrlEncoded<GithubTokenResponse>(
            this.httpService,
            this.cfg.tokenUrl,
            {
              [OAUTH_QUERY.code]: code,
              [OAUTH_QUERY.clientId]: this.clientId,
              [OAUTH_QUERY.clientSecret]: this.clientSecret,
              [OAUTH_QUERY.redirectUri]: this.redirectUri,
              [OAUTH_QUERY.codeVerifier]: codeVerifier,
              ...(this.cfg.tokenExtraParams ?? {}),
            },
            this.cfg.tokenHeaders ?? {},
          ),
        'GithubOAuthClient.exchangeCodeForTokens',
      );
    } catch (error) {
      const { status, body } = getHttpErrorDetails(error);
      throw oauthTokenExchangeFailedError({ metadata: { provider: this.provider, status, body } });
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<GithubUserInfo> {
    try {
      return await retryOAuthRequest(
        this.logger,
        async () => {
          const axiosResponse = await lastValueFrom(
            this.httpService.get<GithubUserInfo>(this.cfg.userInfoUrl, {
              headers: {
                Authorization: bearer(accessToken),
                ...(this.cfg.userInfoHeaders ?? {}),
              },
            }),
          );

          return axiosResponse.data;
        },
        'GithubOAuthClient.fetchUserInfo',
      );
    } catch (error) {
      const { status, body } = getHttpErrorDetails(error);
      throw oauthUserInfoFetchFailedError({ metadata: { provider: this.provider, status, body } });
    }
  }

  private async fetchUserEmails(accessToken: string): Promise<GithubEmail[]> {
    if (!this.cfg.emailsUrl) {
      throw new Error('Provider config missing emailsUrl');
    }

    try {
      return await retryOAuthRequest(
        this.logger,
        async () => {
          const axiosResponse = await lastValueFrom(
            this.httpService.get<GithubEmail[]>(this.cfg.emailsUrl!, {
              headers: {
                Authorization: bearer(accessToken),
                ...(this.cfg.emailsHeaders ?? {}),
              },
            }),
          );

          return axiosResponse.data;
        },
        'GithubOAuthClient.fetchUserEmails',
      );
    } catch (error) {
      const { status, body } = getHttpErrorDetails(error);
      throw oauthEmailsFetchFailedError({ metadata: { provider: this.provider, status, body } });
    }
  }
}
