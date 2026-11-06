import type { ClaimedOutboxEvent } from './outbox.repository.js';

/** Application boundary used by the outbox worker to dispatch committed events. */
export abstract class OutboxEventDispatcher {
  abstract dispatch(event: ClaimedOutboxEvent): Promise<void>;
}
