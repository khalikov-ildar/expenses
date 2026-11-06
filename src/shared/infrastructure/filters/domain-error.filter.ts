import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { DomainError } from '@shared/domain/domain-error.js';
import type { DomainErrorCategory } from '@shared/domain/domain-error.js';
import type { Request, Response } from 'express';

export const DOMAIN_ERROR_HTTP_STATUS: Record<DomainErrorCategory, HttpStatus> = {
  INVALID: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status = DOMAIN_ERROR_HTTP_STATUS[error.category] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      code: error.code,
      message: error.message,
      path: request.originalUrl,
    });
  }
}
