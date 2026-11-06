import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { loginSchema } from '../schemas/login.schema.js';

export function LoginApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Login with email and password' }),
    ApiBody({ type: loginSchema.type }),
    ApiOkResponse({ description: 'Access token issued' }),
  );
}
