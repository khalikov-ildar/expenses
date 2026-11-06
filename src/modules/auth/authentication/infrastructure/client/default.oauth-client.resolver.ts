import { Injectable, OnModuleInit } from '@nestjs/common';
import { OAuthClientResolver } from '../../application/services/oauth-client.resolver.js';
import { ExternalOAuthClient } from '../../application/services/external-oauth.client.js';
import { AuthKind } from '../../../identity/domain/external-identity.js';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { oauthProviderNotSupportedError } from '../../../identity/domain/errors.js';
import { AUTH_CLIENT_METADATA } from '../../application/services/oauth-client.decorator.js';

@Injectable()
export class DefaultOAuthClientResolver implements OAuthClientResolver, OnModuleInit {
  private readonly clients: Map<AuthKind, ExternalOAuthClient> = new Map();

  constructor(
    private discovery: DiscoveryService,
    private reflector: Reflector,
  ) {}

  resolve(provider: AuthKind): ExternalOAuthClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw oauthProviderNotSupportedError({ metadata: { provider } });
    }
    return client;
  }

  onModuleInit() {
    const providers = this.discovery.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance) continue;

      const type = this.reflector.get<AuthKind>(AUTH_CLIENT_METADATA, instance.constructor);
      if (type) {
        this.clients.set(type, instance);
      }
    }
  }
}
