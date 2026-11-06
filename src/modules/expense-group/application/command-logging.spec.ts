import { DomainError, DomainErrorCategory } from '@/shared/domain/domain-error.js';
import { executeWithLogging } from './command-logging.js';

describe('executeWithLogging', () => {
  const createLogger = () => ({
    info: vitest.fn(),
    warn: vitest.fn(),
    error: vitest.fn(),
    debug: vitest.fn(),
  });

  test('logs successful command execution and returns its result', async () => {
    const logger = createLogger();

    await expect(
      executeWithLogging(logger as any, 'expense_group.group.create', { actor_id: 'user-1' }, async () => 'group-1'),
    ).resolves.toBe('group-1');

    expect(logger.info).toHaveBeenCalledWith('expense_group.group.create.succeeded', { actor_id: 'user-1' });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('logs domain failures as warnings and rethrows the same error', async () => {
    const logger = createLogger();
    const failure = new DomainError('expense_group.group.not_found', DomainErrorCategory.NOT_FOUND, 'Not found');

    await expect(
      executeWithLogging(logger as any, 'expense_group.group.create', { actor_id: 'user-1' }, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(logger.warn).toHaveBeenCalledWith('expense_group.group.create.failed', {
      actor_id: 'user-1',
      failureCode: failure.code,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('logs unexpected failures with the original error and rethrows it', async () => {
    const logger = createLogger();
    const failure = new Error('database unavailable');

    await expect(
      executeWithLogging(logger as any, 'expense_group.group.create', { actor_id: 'user-1' }, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith(
      'expense_group.group.create.failed',
      { actor_id: 'user-1', failureCode: 'internal_error' },
      failure,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
