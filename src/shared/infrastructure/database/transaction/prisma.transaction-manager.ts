import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '../prisma/db.js';
import { TransactionManager } from '@shared/application/ports/transaction-manager.js';
import { PrismaClient, PrismaTransaction } from '../prisma/prisma.types.js';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from './transaction-context.js';

@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  private readonly storage = new AsyncLocalStorage<TransactionContext>();

  async startRequest<T>(work: () => Promise<T>): Promise<T> {
    const existing = this.storage.getStore();

    if (existing) {
      return work();
    }

    const context: TransactionContext = {
      depth: 0,
      rollbackOnly: false,
    };

    return this.storage.run(context, work);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const current = this.storage.getStore();

    if (!current) {
      return this.runRoot(work);
    }

    if (current.client) {
      return this.runNested(current, work);
    }

    return this.runRoot(work);
  }

  isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }

  getClient(): PrismaTransaction | PrismaClient {
    return this.storage.getStore()?.client ?? db;
  }

  getClientForRawSql(): PrismaTransaction | ReturnType<typeof db.runtime> {
    return this.storage.getStore()?.client ?? db.runtime();
  }

  private async runRoot<T>(work: () => Promise<T>): Promise<T> {
    return db.transaction(async (client) => {
      const parent = this.storage.getStore();

      const context: TransactionContext = {
        client,
        depth: parent?.depth ?? 0,
        rollbackOnly: false,
      };

      const result = await this.storage.run(context, work);

      if (context.rollbackOnly) {
        // Was: a generic 'TransactionRollbackOnlyError' that hid the real
        // failure from logs and from the domain-error filter. Rethrow the
        // error that actually caused the rollback.
        throw context.firstError ?? new Error('TransactionRollbackOnlyError');
      }

      return result;
    });
  }

  private async runNested<T>(parent: TransactionContext, work: () => Promise<T>): Promise<T> {
    try {
      return await this.storage.run(
        {
          ...parent,
          depth: parent.depth + 1,
        },
        work,
      );
    } catch (error) {
      parent.rollbackOnly = true;
      parent.firstError ??= error;
      throw error;
    }
  }
}
