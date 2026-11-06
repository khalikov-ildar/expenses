import type { NextFunction } from 'express';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SharedModule } from '@shared/shared.module.js';
import { ExpenseGroupModule } from '@expense-group/expense-group.module.js';
import { AlsApplicationContextAccessor } from '@/shared/infrastructure/context/als.application-context.js';
import { AuthApplicationContext } from '@/shared/application/ports/application-context.js';
import { AuthModule } from '@/modules/auth/auth.module.js';
import { OutboxEventDispatcher } from '@/shared/application/ports/outbox-event-dispatcher.js';
import { ApplicationOutboxEventDispatcher } from '@/worker/outbox-event-dispatcher.js';

@Module({
  imports: [SharedModule, ExpenseGroupModule, AuthModule],
  controllers: [],
  providers: [
    ApplicationOutboxEventDispatcher,
    { provide: OutboxEventDispatcher, useExisting: ApplicationOutboxEventDispatcher },
  ],
})
export class AppModule implements NestModule {
  constructor(private als: AlsApplicationContextAccessor) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      // @ts-expect-error ignored params
      .apply((_, __, next: NextFunction) => {
        this.als.run({} as AuthApplicationContext, () => next());
      })
      .forRoutes('*');
  }
}
