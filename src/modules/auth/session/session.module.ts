import { MeHandler } from './application/commands/me.js';
import { RefreshTokenHandler } from './application/commands/refresh-token.js';
import { RefreshTokenPolicy } from './domain/refresh-token.policy.js';
import { SessionController } from './presentation/session.controller.js';
import { IdentityModule } from '../identity/identity.module.js';
import { Clock } from '@/shared/domain/clock.js';
import { Module, Provider } from '@nestjs/common';

const providers: Provider[] = [
  RefreshTokenHandler,
  MeHandler,
  {
    provide: RefreshTokenPolicy,
    inject: [Clock],
    useFactory: (clock: Clock) => new RefreshTokenPolicy(clock),
  },
];

@Module({
  imports: [IdentityModule],
  providers,
  controllers: [SessionController],
})
export class SessionModule {}
