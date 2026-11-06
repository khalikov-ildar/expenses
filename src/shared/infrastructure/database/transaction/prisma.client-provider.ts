import { Injectable } from '@nestjs/common';
import { PrismaTransactionManager } from './prisma.transaction-manager.js';
import { DatabaseClient } from './transaction-context.js';

@Injectable()
export class PrismaClientProvider {
  constructor(private transactionManager: PrismaTransactionManager) {}

  get client(): DatabaseClient {
    return this.transactionManager.getClient();
  }

  get runtime(): ReturnType<typeof this.transactionManager.getClientForRawSql> {
    return this.transactionManager.getClientForRawSql();
  }
}
