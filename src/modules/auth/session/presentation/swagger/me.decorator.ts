import { BearerProtected } from '@/modules/auth/identity/presentation/decorators/bearer.decorator.js';
import { applyDecorators } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation } from '@nestjs/swagger';

export function MeApi() {
  return applyDecorators(ApiOperation({ summary: 'Returns user data' }), ApiNoContentResponse(), BearerProtected());
}
