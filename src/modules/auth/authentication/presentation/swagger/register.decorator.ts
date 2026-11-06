import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiCreatedResponse } from '@nestjs/swagger';
import { registerSchema } from '../schemas/register.schema.js';

export function RegisterApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    ApiOperation({ summary: 'Register a user' }),
    ApiBody({ type: registerSchema.type }),
    ApiCreatedResponse({ description: 'User registered' }),
  );
}
