import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { oauthSchema } from '../schemas/oauth.schema.js';

export function OAuthCallbackApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Authenticate with OAuth provider' }),
    ApiBody({ type: oauthSchema.type }),
    ApiParam({ name: 'provider', enum: ['google', 'github'] }),
    ApiOkResponse({ description: 'Authentication successful, access token issued' }),
    ApiBadRequestResponse({ description: 'Invalid authorization code' }),
  );
}

export function OAuthCallbackQueryApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Authenticate with OAuth provider' }),
    ApiParam({ name: 'provider', enum: ['google', 'github'] }),
    ApiOkResponse({ description: 'Authentication successful, access token issued' }),
    ApiBadRequestResponse({ description: 'Invalid authorization code' }),
  );
}
