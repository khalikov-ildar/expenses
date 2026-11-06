import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { RefreshTokenKey } from '@/modules/auth/identity/presentation/types/refresh-token.key.js';
import { AppConfig } from '@/shared/infrastructure/config/env.schema.js';
import { createSchema } from 'zod-openapi';

const BODY_LIMIT = '256kb';

export function enhanceApp(app: INestApplication): void {
  app.enableShutdownHooks();
  const config = app.get(AppConfig);
  const logger = app.get(Logger);

  // Correct client IPs behind a load balancer (rate limiting, logs).
  // Set to the number of trusted proxy hops in front of the app.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: false, limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.useLogger(logger);

  // Never use origin: '*' together with credentials: true.
  // app.enableCors({
  //   origin: config.serverCorsOrigins,
  //   credentials: true,
  // });

  // Interactive API docs must not ship to production.
  if (config.environment !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Expense')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth(RefreshTokenKey)
      .build();

    const documentOptions: SwaggerDocumentOptions = {
      standardSchemaConverter: (schema, { schemaType }) => {
        const converted = createSchema(schema as never, {
          io: schemaType,
          openapiVersion: '3.0.0',
        });
        return { schema: converted.schema, components: converted.components };
      },
    };
    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig, documentOptions);
    SwaggerModule.setup('api', app, documentFactory);
  }

  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));
}
