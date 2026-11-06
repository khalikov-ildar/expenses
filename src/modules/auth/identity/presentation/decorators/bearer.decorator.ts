import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function BearerProtected() {
  return applyDecorators(ApiBearerAuth(), ApiUnauthorizedResponse({ description: 'Invalid token or no token' }));
}
