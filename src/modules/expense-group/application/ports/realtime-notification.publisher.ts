import type { IdentityId } from '@/shared/domain/id/auth.js';

export type RealtimeNotificationType =
  | 'group.invitation.created'
  | 'group.invitation.accepted'
  | 'group.invitation.rejected'
  | 'group.invitation.expired'
  | 'group.member.joined'
  | 'group.member.left'
  | 'group.expense.created';

export interface RealtimeNotification {
  /** Stable outbox event ID. Clients can use it to de-duplicate at-least-once deliveries. */
  id: string;
  type: RealtimeNotificationType;
  occurredAt: string;
  data: Record<string, unknown>;
}

/** Application-facing port for delivering a notification to all live sessions for an identity. */
export abstract class RealtimeNotificationPublisher {
  abstract notifyUser(userId: IdentityId, notification: RealtimeNotification): void;
}
