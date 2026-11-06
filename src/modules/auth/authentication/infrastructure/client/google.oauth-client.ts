import { buildAuthorizationUrl, postFormUrlEncoded } from '../oauth-http.js';
import { bearer, OAUTH_QUERY } from '../oauth-protocol.js';
import { OAUTH_PROVIDER_CONFIG, OAuthProviderConfig } from '../oauth-provider.config.js';
import { getHttpErrorDetails, retryOAuthRequest } from '../oauth-retry.js';
import { oauthTokenExchangeFailedError, oauthUserInfoFetchFailedError } from '../../../identity/domain/errors.js';
import { AuthKinds } from '../../../identity/domain/external-identity.js';
import { ExternalOAuthClient, OAuthProfile } from '../../application/services/external-oauth.client.js';
import { AuthClient } from '../../application/services/oauth-client.decorator.js';
import { AppConfig, OAuthConfig } from '@/shared/infrastructure/config/env.schema.js';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
@AuthClient(AuthKinds.google)
export class GoogleOAuthClient implements ExternalOAuthClient {
  readonly provider = AuthKinds.google;
  private readonly cfg: OAuthProviderConfig = OAUTH_PROVIDER_CONFIG.google;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    cfg: OAuthConfig,
    private readonly httpService: HttpService,
    private readonly logger: ApplicationLogger,
  ) {
    this.clientId = cfg.oauthGoogle.clientId;
    this.clientSecret = cfg.oauthGoogle.clientSecret;
    this.redirectUri = cfg.oauthGoogle.redirectUri;
  }

  async exchangeCode(input: { code: string; codeVerifier: string }): Promise<OAuthProfile> {
    const tokens = await this.exchangeCodeForTokens(input.code, input.codeVerifier);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    return {
      providerUserId: userInfo.sub,
      email: userInfo.email,
      emailVerified: userInfo.email_verified,
      name: userInfo.name,
      picture: userInfo.picture,
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

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<GoogleTokenResponse> {
    try {
      return await retryOAuthRequest(
        this.logger,
        () =>
          postFormUrlEncoded<GoogleTokenResponse>(
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
        'GoogleOAuthClient.exchangeCodeForTokens',
      );
    } catch (error) {
      const { status, body } = getHttpErrorDetails(error);
      throw oauthTokenExchangeFailedError({ metadata: { provider: this.provider, status, body } });
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      return await retryOAuthRequest(
        this.logger,
        async () => {
          const axiosResponse = await lastValueFrom(
            this.httpService.get<GoogleUserInfo>(this.cfg.userInfoUrl, {
              headers: {
                Authorization: bearer(accessToken),
                ...(this.cfg.userInfoHeaders ?? {}),
              },
            }),
          );

          return axiosResponse.data;
        },
        'GoogleOAuthClient.fetchUserInfo',
      );
    } catch (error) {
      const { status, body } = getHttpErrorDetails(error);
      throw oauthUserInfoFetchFailedError({ metadata: { provider: this.provider, status, body } });
    }
  }
}
