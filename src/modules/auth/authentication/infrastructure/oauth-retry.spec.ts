import { AxiosError } from 'axios';
import { getHttpErrorDetails, isRetryableOAuthError, retryOAuthRequest } from './oauth-retry.js';

describe('oauth-retry', () => {
  test.each([408, 409, 425, 429, 500, 502, 503, 504])('recognizes transient HTTP status %s as retryable', (status) => {
    const error = new AxiosError('boom', undefined, undefined, undefined, {
      status,
      statusText: 'error',
      headers: {},
      config: { headers: {} as any },
      data: {},
    });

    expect(isRetryableOAuthError(error)).toBe(true);
  });

  test.each([400, 401, 403, 404])('does not retry HTTP status %s', (status) => {
    const error = new AxiosError('boom', undefined, undefined, undefined, {
      status,
      statusText: 'error',
      headers: {},
      config: { headers: {} as any },
      data: {},
    });

    expect(isRetryableOAuthError(error)).toBe(false);
  });

  test.each(['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'])(
    'recognizes network code %s as retryable',
    (code) => {
      expect(isRetryableOAuthError(new AxiosError('boom', code))).toBe(true);
    },
  );

  test('does not retry ordinary domain errors', () => {
    expect(isRetryableOAuthError(new Error('boom'))).toBe(false);
  });

  test('retries transient failure and eventually returns the successful result', async () => {
    const logger = { warn: vitest.fn(), error: vitest.fn() };
    const operation = vitest
      .fn()
      .mockRejectedValueOnce(new AxiosError('temporary', 'ECONNRESET'))
      .mockResolvedValueOnce('ok');

    await expect(retryOAuthRequest(logger, operation, 'test.operation')).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('does not retry non-transient failure', async () => {
    const logger = { warn: vitest.fn(), error: vitest.fn() };
    const operation = vitest.fn().mockRejectedValue(new AxiosError('bad request', undefined));

    await expect(retryOAuthRequest(logger, operation, 'test.operation')).rejects.toThrow('bad request');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('stops after the configured maximum attempts', async () => {
    const logger = { warn: vitest.fn(), error: vitest.fn() };
    const operation = vitest.fn().mockRejectedValue(new AxiosError('temporary', 'ECONNRESET'));

    await expect(retryOAuthRequest(logger, operation, 'test.operation')).rejects.toThrow('temporary');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('extracts safe HTTP error details', () => {
    const error = new AxiosError('boom', undefined, undefined, undefined, {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: { headers: {} as any },
      data: { code: 'upstream_failure' },
    });

    expect(getHttpErrorDetails(error)).toEqual({
      status: 502,
      body: JSON.stringify({ code: 'upstream_failure' }),
    });
  });
});
