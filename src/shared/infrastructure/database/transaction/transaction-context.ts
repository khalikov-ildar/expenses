import { PrismaClient, PrismaTransaction } from '../prisma/prisma.types.js';

export interface TransactionContext {
  readonly client?: PrismaTransaction;
  readonly depth: number;
  rollbackOnly: boolean;
  /** First error that forced the surrounding transaction to roll back. */
  firstError?: unknown;
}

export type DatabaseClient = PrismaClient | PrismaTransaction;
