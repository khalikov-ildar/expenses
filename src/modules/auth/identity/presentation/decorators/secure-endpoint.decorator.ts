import { applyDecorators } from '@nestjs/common';
import { AuthTypes } from '../types/auth-type.js';
import { CsrfHeaderName } from '../types/csrf.js';
import { RefreshTokenKey } from '../types/refresh-token.key.js';
import { Security, SecurityOptions } from '../types/security.js';
import { ApiBearerAuth, ApiCookieAuth, ApiHeader, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function SecureEndpoint(options: SecurityOptions = { auth: 'BEARER', csrf: false }) {
  const decorators: (ClassDecorator & ParameterDecorator)[] = [];
  decorators.push(Security(options ?? {}));

  decorators.push(...buildSwaggerDecorators(options));

  return applyDecorators(...decorators);
}

function buildSwaggerDecorators(options: SecurityOptions) {
  const decorators: (ClassDecorator & ParameterDecorator)[] = [];

  switch (options.auth) {
    case AuthTypes.BEARER:
      decorators.push(ApiBearerAuth());
      break;
    case AuthTypes.COOKIE:
      decorators.push(ApiCookieAuth(RefreshTokenKey));
      break;
    case AuthTypes.NONE:
      break;
  }

  if (options.auth !== AuthTypes.NONE) {
    decorators.push(ApiUnauthorizedResponse({ description: 'Unauthorized' }));
  }

  if (options.csrf) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: 'Missing or invalid CSRF token',
      }),
      ApiHeader({
        name: CsrfHeaderName,
        required: true,
        description: 'CSRF protection token',
      }),
    );
  }

  return decorators;
}
