import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { TokenProvider } from '@/modules/auth/identity/application/ports/token-provider.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import type { IdentityId } from '@/shared/domain/id/auth.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import type { RealtimeNotification } from '../../application/ports/realtime-notification.publisher.js';

/**
 * Authenticated, server-to-client notifications. Clients never choose their
 * room: the room is derived from the verified access token subject.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  transports: ['websocket'],
})
export class GroupNotificationsGateway
  implements
    OnGatewayInit<Namespace>,
    OnGatewayConnection<Socket>,
    OnGatewayDisconnect<Socket>
{
  @WebSocketServer()
  private server!: Namespace;

  constructor(
    private readonly tokenProvider: TokenProvider,
    private readonly logger: ApplicationLogger,
  ) {}

  afterInit(server: Namespace): void {
    server.use((client, next) => {
      void this.authenticate(client)
        .then(() => next())
        .catch(() => {
          this.logger.warn('notifications.websocket.unauthorized');
          next(new Error('unauthorized'));
        });
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const userId = client.data.userId as IdentityId | undefined;
    if (!userId) {
      client.disconnect(true);
      return;
    }

    await client.join(this.userRoom(userId));
    this.logger.debug('notifications.websocket.connected', { user_id: userId });
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as IdentityId | undefined;
    if (userId) {
      this.logger.debug('notifications.websocket.disconnected', { user_id: userId });
    }
  }

  emitToUser(userId: IdentityId, notification: RealtimeNotification): void {
    if (!this.server) {
      throw new Error('Notification WebSocket gateway is not initialized');
    }
    this.server.to(this.userRoom(userId)).emit('notification', notification);
  }

  private async authenticate(client: Socket): Promise<void> {
    const token = this.extractAccessToken(client);
    if (!token) {
      throw new Error('Missing access token');
    }

    const payload = await this.tokenProvider.verifyAccessToken(token);
    if (
      typeof payload?.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.jti !== 'string' ||
      payload.jti.length === 0 ||
      payload.tokenUse !== 'access'
    ) {
      throw new Error('Invalid access token payload');
    }

    // Never accept a client-supplied user/room id. The verified token subject
    // is the only source of identity used to join a notification room.
    client.data.userId = AuthUserIdFactory.create(payload.sub);
  }

  private extractAccessToken(client: Socket): string | undefined {
    const authToken: unknown = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [scheme, token, ...rest] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      return undefined;
    }
    return token;
  }

  private userRoom(userId: IdentityId): string {
    return `user:${userId}`;
  }
}
