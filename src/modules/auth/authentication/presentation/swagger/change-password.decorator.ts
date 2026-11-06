import { BearerProtected } from '@/modules/auth/identity/presentation/decorators/bearer.decorator.js';
import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { changePasswordSchema } from '../schemas/change-password.schema.js';

export function ChangePasswordApi() {
  return applyDecorators(
    HttpCode(HttpStatus.NO_CONTENT),
    ApiOperation({ summary: 'Change password' }),
    ApiOkResponse({ description: 'Password has changed' }),
    ApiBody({ type: changePasswordSchema.type }),
    BearerProtected(),
  );
}
