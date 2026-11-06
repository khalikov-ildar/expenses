import { ExponentialBackoff, handleWhen, retry } from 'cockatiel';
import { AxiosError } from 'axios';

const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_AXIOS_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN']);

export type RetryLogger = {
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>, error?: unknown) => void;
};

const OAUTH_RETRY_MAX_ATTEMPTS = 3;
const OAUTH_MAX_RETRIES = OAUTH_RETRY_MAX_ATTEMPTS - 1;
const OAUTH_RETRY_BACKOFF = {
  initialDelay: 128,
  maxDelay: 2000,
};

export async function retryOAuthRequest<T>(
  logger: RetryLogger,
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  const oauthRetryPolicy = retry(handleWhen(isRetryableOAuthError), {
    maxAttempts: OAUTH_MAX_RETRIES,
    backoff: new ExponentialBackoff(OAUTH_RETRY_BACKOFF),
  }).dangerouslyUnref();

  const onRetry = oauthRetryPolicy.onRetry(({ attempt, delay }) => {
    logger.warn('OAuth request retry scheduled', {
      event: 'oauth_request_retry',
      operationName,
      attempt,
      maxAttempts: OAUTH_MAX_RETRIES,
      delayMs: Math.round(delay),
    });
  });

  try {
    return await oauthRetryPolicy.execute(operation);
  } catch (error) {
    logger.error('OAuth request failed after max attempts', {
      event: 'oauth_request_failed_final',
      operationName,
      maxAttempts: OAUTH_MAX_RETRIES,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    onRetry.dispose();
  }
}

function getRetryReasonMessage(reason: { error: unknown } | { value: unknown }): string {
  const value = 'error' in reason ? reason.error : reason.value;
  return value instanceof Error ? value.message : String(value);
}

export function isRetryableOAuthError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return isRetryableAxiosError(error);
  }

  return false;
}

function isRetryableAxiosError(error: AxiosError): boolean {
  const status = error.response?.status;
  if (status !== undefined) {
    return RETRYABLE_HTTP_STATUSES.has(status);
  }

  if (error.code) {
    return RETRYABLE_AXIOS_CODES.has(error.code);
  }

  return false;
}

export function getHttpErrorDetails(error: unknown): { status: number; body: string } {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 500;
    const responseBody = error.response?.data;
    if (typeof responseBody === 'string') {
      return { status, body: responseBody };
    }
    if (responseBody !== undefined) {
      try {
        return { status, body: JSON.stringify(responseBody) };
      } catch {
        return { status, body: 'Unserializable response body' };
      }
    }
    return { status, body: error.message };
  }

  if (error instanceof Error) {
    return { status: 500, body: error.message };
  }

  return { status: 500, body: 'Unknown error' };
}
