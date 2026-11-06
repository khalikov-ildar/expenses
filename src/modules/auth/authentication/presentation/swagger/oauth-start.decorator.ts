import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';

export function OAuthStartApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    ApiOperation({ summary: 'Start OAuth flow' }),
    ApiParam({ name: 'provider', enum: ['google', 'github'] }),
    ApiOkResponse({ description: 'OAuth authorization URL' }),
  );
}
