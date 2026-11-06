import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { AuthTypes } from '@/modules/auth/identity/presentation/types/auth-type.js';
import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiNoContentResponse } from '@nestjs/swagger';
import { requestEmailVerificationSchema, verifyEmailSchema } from '../schemas/email-verification.schema.js';

export function RequestEmailVerificationApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    HttpCode(HttpStatus.ACCEPTED),
    ApiOperation({ summary: 'Request an email verification message' }),
    ApiBody({ type: requestEmailVerificationSchema.type }),
    ApiNoContentResponse({ description: 'Request accepted' }),
  );
}

export function VerifyEmailApi() {
  return applyDecorators(
    SecureEndpoint({ auth: AuthTypes.NONE }),
    HttpCode(HttpStatus.NO_CONTENT),
    ApiOperation({ summary: 'Verify an email address' }),
    ApiBody({ type: verifyEmailSchema.type }),
    ApiNoContentResponse({ description: 'Email verified' }),
  );
}
