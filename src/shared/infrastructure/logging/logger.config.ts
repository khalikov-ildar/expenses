import type { Params } from 'nestjs-pino';
import { uuidv7 } from 'uuidv7';

const isProduction = process.env.NODE_ENV === 'production';

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TRUST_PROXY_REQUEST_ID = process.env.TRUST_PROXY_REQUEST_ID === 'true';

export function createLoggerConfig(): Params {
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

      // Let the platform/container own log collection.
      // Production stays as JSON on stdout.
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
              },
            },
          }),

      // Don't emit PID/hostname when the runtime already provides
      // container/pod/process metadata.
      base: null,

      // Use a stable, platform-independent request identifier.
      genReqId: (req) => {
        const header = req.headers['x-request-id'];

        if (TRUST_PROXY_REQUEST_ID && typeof header === 'string' && REQUEST_ID_RE.test(header)) {
          return header;
        }

        return uuidv7();
      },

      // Request id is attached by pino-http; application logs emitted
      // through PinoLogger inherit the active request context.
      quietReqLogger: true,

      serializers: {
        req: (req) => {
          // Strip the query string before logging. The OAuth callback is
          // exposed over GET, so req.url used to carry `?code=...&state=...`
          // into log aggregation (and into any downstream SIEM).
          const rawUrl = req.url as string | undefined;
          const url = typeof rawUrl === 'string' ? rawUrl.split('?')[0] : rawUrl;
          return {
            id: req.id,
            method: req.method,
            url,
          };
        },
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },

      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["x-api-key"]',
        'req.headers["x-auth-token"]',
        'password',
        'passwd',
        'secret',
        'token',
        'accessToken',
        'refreshToken',
        'clientSecret',
        '*.password',
        '*.passwd',
        '*.secret',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.clientSecret',
      ],

      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        return 'info';
      },
    },
  };
}
