import { Injectable } from '@nestjs/common';
import type { IdentityId } from '@/shared/domain/id/auth.js';
import {
  RealtimeNotificationPublisher,
  type RealtimeNotification,
} from '../../application/ports/realtime-notification.publisher.js';
import { GroupNotificationsGateway } from '../../presentation/websocket/group-notifications.gateway.js';

/** Infrastructure adapter: translates the application port to Socket.IO. */
@Injectable()
export class SocketIoRealtimeNotificationPublisher implements RealtimeNotificationPublisher {
  constructor(private readonly gateway: GroupNotificationsGateway) {}

  notifyUser(userId: IdentityId, notification: RealtimeNotification): void {
    this.gateway.emitToUser(userId, notification);
  }
}
