import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Observable } from 'rxjs';
import { PrismaTransactionManager } from './prisma.transaction-manager.js';

@Injectable()
export class TransactionContextInterceptor implements NestInterceptor {
  constructor(private readonly transactions: PrismaTransactionManager) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      this.transactions.startRequest(async () => {
        const subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });

        return new Promise<void>((resolve) => {
          subscriber.add(() => {
            subscription.unsubscribe();
            resolve();
          });
        });
      });
    });
  }
}
