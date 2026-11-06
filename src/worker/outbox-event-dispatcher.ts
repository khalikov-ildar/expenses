import { Injectable } from '@nestjs/common';
import type { ClaimedOutboxEvent } from '@/shared/application/ports/outbox.repository.js';
import { OutboxEventDispatcher } from '@/shared/application/ports/outbox-event-dispatcher.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { GroupRealtimeNotificationHandler } from '@/modules/expense-group/application/handlers/group-realtime-notification.handler.js';

/**
 * Application-level routing for persisted domain events. The worker knows
 * only the OutboxEventDispatcher port; feature-specific behavior stays here.
 */
@Injectable()
export class ApplicationOutboxEventDispatcher implements OutboxEventDispatcher {
  constructor(
    private readonly groupNotifications: GroupRealtimeNotificationHandler,
    private readonly logger: ApplicationLogger,
  ) {}

  async dispatch(event: ClaimedOutboxEvent): Promise<void> {
    switch (event.type) {
      case 'auth-user.registered':
        // Registration has no live notification requirement; retain an
        // explicit, observable handler so the event is not silently ignored.
        this.logger.info('auth.user.registered', {
          user_id: event.aggregateId,
          event_id: event.id,
        });
        return;
      case 'group-invitation.created':
        await this.groupNotifications.created(event);
        return;
      case 'group-invitation.accepted':
        await this.groupNotifications.accepted(event);
        return;
      case 'group-invitation.rejected':
        await this.groupNotifications.rejected(event);
        return;
      case 'group-invitation.expired':
        await this.groupNotifications.expired(event);
        return;
      case 'group-member.left':
        await this.groupNotifications.memberLeft(event);
        return;
      case 'expense-group.expense.created':
        await this.groupNotifications.expenseCreated(event);
        return;
      default:
        this.logger.warn('shared.outbox.event.unhandled', {
          event_type: event.type,
          aggregate_id: event.aggregateId,
        });
        // A failed job is retried/dead-lettered by the existing outbox worker.
        throw new Error(`Unhandled outbox event type: ${event.type}`);
    }
  }
}
