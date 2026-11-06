import { DomainError } from '@/shared/domain/domain-error.js';
import type { ApplicationLogger, ApplicationLogFields } from '@/shared/application/ports/application-logger.js';

/**
 * Adds a consistent structured logging boundary to an application command.
 * Domain failures are expected outcomes and are logged as warnings; unexpected
 * failures are logged with their Error object so Pino can retain the stack.
 * Errors are always rethrown unchanged for the global exception filter.
 */
export async function executeWithLogging<T>(
  logger: ApplicationLogger,
  event: string,
  fields: ApplicationLogFields,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation();
    logger.info(`${event}.succeeded`, fields);
    return result;
  } catch (error) {
    const failureFields = {
      ...fields,
      failureCode: error instanceof DomainError ? error.code : 'internal_error',
    };

    if (error instanceof DomainError) {
      logger.warn(`${event}.failed`, failureFields);
    } else {
      logger.error(`${event}.failed`, failureFields, error);
    }

    throw error;
  }
}
