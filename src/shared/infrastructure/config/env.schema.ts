import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

const envBoolean = z.enum(['true', 'false']).transform((v) => v === 'true');

const sameSiteSchema = z.enum(['lax', 'strict', 'none']);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),

  HOST: z.hostname(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  ENABLE_METRICS: envBoolean.default(false),

  DATABASE_URL: z.url(),

  REDIS_USERNAME: z.string(),
  REDIS_PASSWORD: z.string(),
  REDIS_HOST: z.hostname(),
  REDIS_PORT: z.coerce.number().int().min(1).max(65_535),

  OAUTH_STATE_TTL_MS: z.coerce.number().int().positive().default(600_000),

  EMAIL_VERIFICATION_TTL_MS: z.coerce.number().int().positive().default(86_400_000),
  MAIL_SENDER_ADDRESS: z.email(),

  ACCESS_TOKEN_TTL_MS: z.coerce.number().int().positive().default(900_000),

  REFRESH_TOKEN_TTL_MS: z.coerce.number().int().positive().default(2_592_000_000),

  REFRESH_TOKEN_FAMILY_TTL_MS: z.coerce.number().int().positive().default(7_776_000_000),

  OUTBOX_JOB_QUEUE: z.string(),
  OUTBOX_JOB_NAME: z.string(),
  OUTBOX_MAX_RETRIES: z.coerce.number().int().positive(),

  GOOGLE_CLIENT_ID: z.string().min(32),
  GOOGLE_CLIENT_SECRET: z.string().min(16),
  GOOGLE_REDIRECT_URI: z.url(),

  GITHUB_CLIENT_ID: z.string().min(16),
  GITHUB_CLIENT_SECRET: z.string().min(16),
  GITHUB_REDIRECT_URI: z.url(),

  RESEND_API_KEY: z.string(),

  AUTH_COOKIE_SECURE: envBoolean.default(true),
  AUTH_COOKIE_SAME_SITE: sameSiteSchema.default('lax'),

  REFRESH_TOKEN_HASH_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_SECRET: z.string().min(32),
});

export type EnvSchema = z.infer<typeof envSchema>;
export type Environment = EnvSchema['NODE_ENV'];
export type AuthCookieSameSite = z.infer<typeof sameSiteSchema>;
export type LogLevel = EnvSchema['LOG_LEVEL'];

/**
 * These abstract classes are the public configuration contracts.
 *
 * They are intentionally small because they are also Nest DI tokens.
 */

export abstract class EnvironmentConfig {
  abstract readonly environment: Environment;
}

export abstract class ServerConfig {
  abstract readonly serverHost: string;
  abstract readonly serverPort: number;
}

export abstract class LoggerConfig {
  abstract readonly level: LogLevel;
}

export abstract class MetricsConfig {
  abstract readonly metricsEnabled: boolean;
}

export abstract class DatabaseConfig {
  abstract readonly dbUrl: string;
}

export abstract class RedisConfig {
  // abstract readonly redisUsername: string;
  abstract readonly redisPassword: string;
  abstract readonly redisHost: string;
  abstract readonly redisPort: number;
}

export abstract class OutboxConfig {
  abstract readonly outboxJobQueue: string;
  abstract readonly outboxJobName: string;
  abstract readonly outboxMaxRetries: number;
}

/**
 * Auth capabilities
 */

export abstract class AuthCookieConfig {
  abstract readonly authCookieSecure: boolean;
  abstract readonly authCookieSameSite: AuthCookieSameSite;
}

export abstract class EmailVerificationConfig {
  abstract readonly emailSenderAddress: string;
  abstract readonly emailApiKey: string;
  abstract readonly emailVerificationTtl: number;
}

export abstract class OAuthProviderConfig {
  abstract readonly clientId: string;
  abstract readonly clientSecret: string;
  abstract readonly redirectUri: string;
}

export abstract class OAuthConfig {
  abstract readonly oauthStateTtl: number;
  abstract readonly oauthGoogle: OAuthProviderConfig;
  abstract readonly oauthGithub: OAuthProviderConfig;
}

export abstract class AccessTokenConfig {
  abstract readonly accessSecret: string;
  abstract readonly accessTtl: number;
}

export abstract class RefreshTokenConfig {
  abstract readonly refreshSecret: string;
  abstract readonly refreshHashSecret: string;
  abstract readonly refreshTtl: number;
  abstract readonly refreshFamilyTtl: number;
}

/**
 * Internal composition object.
 *
 * Consumers should generally NOT inject this.
 */
export class AppConfig
  implements
    EnvironmentConfig,
    ServerConfig,
    LoggerConfig,
    MetricsConfig,
    DatabaseConfig,
    RedisConfig,
    OutboxConfig,
    AuthCookieConfig,
    EmailVerificationConfig,
    OAuthConfig,
    AccessTokenConfig,
    RefreshTokenConfig
{
  constructor(
    private readonly environmentConfig: EnvironmentConfig,
    private readonly serverConfig: ServerConfig,
    private readonly loggerConfig: LoggerConfig,
    private readonly metricsConfig: MetricsConfig,
    private readonly databaseConfig: DatabaseConfig,
    private readonly outboxConfig: OutboxConfig,
    private readonly redisConfig: RedisConfig,
    private readonly authCookieConfig: AuthCookieConfig,
    private readonly emailVerificationConfig: EmailVerificationConfig,
    private readonly oauthConfig: OAuthConfig,
    private readonly accessTokenConfig: AccessTokenConfig,
    private readonly refreshTokenConfig: RefreshTokenConfig,
  ) {}
  get environment() {
    return this.environmentConfig.environment;
  }
  get serverHost() {
    return this.serverConfig.serverHost;
  }
  get serverPort() {
    return this.serverConfig.serverPort;
  }
  get level() {
    return this.loggerConfig.level;
  }
  get metricsEnabled() {
    return this.metricsConfig.metricsEnabled;
  }
  get dbUrl() {
    return this.databaseConfig.dbUrl;
  }
  // get redisUsername() {
  //   return this.redisConfig.redisUsername;
  // }
  get redisPassword() {
    return this.redisConfig.redisPassword;
  }
  get redisHost() {
    return this.redisConfig.redisHost;
  }
  get redisPort() {
    return this.redisConfig.redisPort;
  }
  get outboxJobQueue() {
    return this.outboxConfig.outboxJobQueue;
  }
  get outboxJobName() {
    return this.outboxConfig.outboxJobName;
  }
  get outboxMaxRetries() {
    return this.outboxConfig.outboxMaxRetries;
  }
  get authCookieSecure() {
    return this.authCookieConfig.authCookieSecure;
  }
  get authCookieSameSite() {
    return this.authCookieConfig.authCookieSameSite;
  }
  get emailSenderAddress() {
    return this.emailVerificationConfig.emailSenderAddress;
  }
  get emailApiKey() {
    return this.emailVerificationConfig.emailApiKey;
  }
  get emailVerificationTtl() {
    return this.emailVerificationConfig.emailVerificationTtl;
  }
  get oauthStateTtl() {
    return this.oauthConfig.oauthStateTtl;
  }
  get oauthGoogle() {
    return this.oauthConfig.oauthGoogle;
  }
  get oauthGithub() {
    return this.oauthConfig.oauthGithub;
  }
  get accessSecret() {
    return this.accessTokenConfig.accessSecret;
  }
  get accessTtl() {
    return this.accessTokenConfig.accessTtl;
  }
  get refreshSecret() {
    return this.refreshTokenConfig.refreshSecret;
  }
  get refreshHashSecret() {
    return this.refreshTokenConfig.refreshHashSecret;
  }
  get refreshTtl() {
    return this.refreshTokenConfig.refreshTtl;
  }
  get refreshFamilyTtl() {
    return this.refreshTokenConfig.refreshFamilyTtl;
  }
}

export function createAppConfig(config: ConfigService<EnvSchema, true>): AppConfig {
  const server: ServerConfig = {
    serverHost: config.get('HOST'),
    serverPort: config.get('PORT'),
  };

  const environment: EnvironmentConfig = {
    environment: config.get('NODE_ENV'),
  };

  const logger: LoggerConfig = {
    level: config.get('LOG_LEVEL'),
  };

  const metrics: MetricsConfig = {
    metricsEnabled: config.get('ENABLE_METRICS', { infer: true }),
  };

  const db: DatabaseConfig = {
    dbUrl: config.get('DATABASE_URL'),
  };

  const redis: RedisConfig = {
    // redisUsername: config.get('REDIS_USERNAME'),
    redisPassword: config.get('REDIS_PASSWORD'),
    redisHost: config.get('REDIS_HOST'),
    redisPort: config.get('REDIS_PORT'),
  };

  const outbox: OutboxConfig = {
    outboxJobQueue: config.get('OUTBOX_JOB_QUEUE'),
    outboxJobName: config.get('OUTBOX_JOB_NAME'),
    outboxMaxRetries: config.get('OUTBOX_MAX_RETRIES'),
  };

  const cookies: AuthCookieConfig = {
    authCookieSecure: config.get('AUTH_COOKIE_SECURE'),
    authCookieSameSite: config.get('AUTH_COOKIE_SAME_SITE'),
  };

  const emailVerification: EmailVerificationConfig = {
    emailSenderAddress: config.get('MAIL_SENDER_ADDRESS'),
    emailApiKey: config.get('RESEND_API_KEY'),
    emailVerificationTtl: config.get('EMAIL_VERIFICATION_TTL_MS'),
  };

  const oauth: OAuthConfig = {
    oauthStateTtl: config.get('OAUTH_STATE_TTL_MS'),

    oauthGoogle: {
      clientId: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      redirectUri: config.get('GOOGLE_REDIRECT_URI'),
    },

    oauthGithub: {
      clientId: config.get('GITHUB_CLIENT_ID'),
      clientSecret: config.get('GITHUB_CLIENT_SECRET'),
      redirectUri: config.get('GITHUB_REDIRECT_URI'),
    },
  };

  const accessToken: AccessTokenConfig = {
    accessSecret: config.get('ACCESS_TOKEN_SECRET'),
    accessTtl: config.get('ACCESS_TOKEN_TTL_MS'),
  };

  const refreshToken: RefreshTokenConfig = {
    refreshSecret: config.get('REFRESH_TOKEN_SECRET'),
    refreshHashSecret: config.get('REFRESH_TOKEN_HASH_SECRET'),
    refreshTtl: config.get('REFRESH_TOKEN_TTL_MS'),
    refreshFamilyTtl: config.get('REFRESH_TOKEN_FAMILY_TTL_MS'),
  };

  return new AppConfig(
    environment,
    server,
    logger,
    metrics,
    db,
    outbox,
    redis,
    cookies,
    emailVerification,
    oauth,
    accessToken,
    refreshToken,
  );
}

export const isProduction = (environmentConfig: EnvironmentConfig): boolean => {
  return environmentConfig.environment === 'production';
};
