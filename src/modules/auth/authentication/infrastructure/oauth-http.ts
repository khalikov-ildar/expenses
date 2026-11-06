import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { HTTP_HEADER_VALUES, HTTP_HEADERS, OAUTH_QUERY, OAUTH_VALUES } from './oauth-protocol.js';

export function buildAuthorizationUrl(input: {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: readonly string[];
}): string {
  const params = new URLSearchParams({
    [OAUTH_QUERY.clientId]: input.clientId,
    [OAUTH_QUERY.redirectUri]: input.redirectUri,
    [OAUTH_QUERY.responseType]: OAUTH_VALUES.responseTypeCode,
    [OAUTH_QUERY.scope]: input.scopes.join(' '),
    [OAUTH_QUERY.state]: input.state,
    [OAUTH_QUERY.codeChallenge]: input.codeChallenge,
    [OAUTH_QUERY.codeChallengeMethod]: OAUTH_VALUES.codeChallengeMethodS256,
  });

  return `${input.authorizationUrl}?${params.toString()}`;
}

export async function postFormUrlEncoded<T>(
  httpService: HttpService,
  url: string,
  params: Readonly<Record<string, string>>,
  headers: Readonly<Record<string, string>> = {},
): Promise<T> {
  const body = new URLSearchParams(params).toString();

  const axiosResponse = await lastValueFrom(
    httpService.post<T>(url, body, {
      headers: {
        [HTTP_HEADERS.contentType]: HTTP_HEADER_VALUES.formUrlEncoded,
        ...headers,
      },
    }),
  );

  return axiosResponse.data;
}
