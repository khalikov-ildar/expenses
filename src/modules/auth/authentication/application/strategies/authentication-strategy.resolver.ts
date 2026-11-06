import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { Strategy } from './strategy.map.js';

export abstract class AuthenticationStrategyResolver {
  abstract resolve<Provider extends AuthKind>(provider: Provider): Strategy[Provider];
}
