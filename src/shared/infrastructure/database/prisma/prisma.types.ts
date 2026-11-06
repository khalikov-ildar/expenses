import { db } from './db.js';

export type PrismaTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PrismaClient = typeof db;
