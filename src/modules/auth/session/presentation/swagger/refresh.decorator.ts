import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';

export function RefreshApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.COOKIE, csrf: true }),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Refresh access token' }),
    ApiOkResponse({ description: 'Access token refreshed' }),
  );
}
