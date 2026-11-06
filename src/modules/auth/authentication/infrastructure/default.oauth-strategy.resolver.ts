import { oauthStrategyNotConfiguredError } from '../../identity/domain/errors.js';
import { AuthKind } from '../../identity/domain/external-identity.js';
import { AUTH_STRATEGY_METADATA } from '../application/strategies/authentication-strategy.decorator.js';
import { AuthenticationStrategyResolver } from '../application/strategies/authentication-strategy.resolver.js';
import { AuthenticationStrategy } from '../application/strategies/authentication.strategy.js';
import { Strategy } from '../application/strategies/strategy.map.js';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

@Injectable()
export class DefaultOAuthStrategyResolver implements AuthenticationStrategyResolver, OnModuleInit {
  private readonly strategies: Map<AuthKind, AuthenticationStrategy<AuthKind>> = new Map();

  constructor(
    private discovery: DiscoveryService,
    private reflector: Reflector,
  ) {}

  resolve<Provider extends AuthKind>(provider: Provider): Strategy[Provider] {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw oauthStrategyNotConfiguredError({ metadata: { provider } });
    }
    return strategy as unknown as Strategy[Provider];
  }

  onModuleInit() {
    const providers = this.discovery.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const type = this.reflector.get<AuthKind>(AUTH_STRATEGY_METADATA, instance.constructor);
      if (type) {
        this.strategies.set(type, instance);
      }
    }
  }
}
