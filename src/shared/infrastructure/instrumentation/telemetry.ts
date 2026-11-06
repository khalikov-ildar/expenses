import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'expense-api';
const serviceVersion = process.env.APP_VERSION ?? 'unknown';
const environment = process.env.NODE_ENV ?? 'development';
const enableMetrics = process.env.ENABLE_METRICS === 'true';

const metricReaders = enableMetrics
  ? [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ timeoutMillis: 10_000 }),
        exportIntervalMillis: 60_000,
      }),
    ]
  : [];

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
  }),
  traceExporter: new OTLPTraceExporter({ timeoutMillis: 10_000 }),
  metricReaders,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          const path = (req.url ?? '').split('?', 1)[0];
          return path === '/health' || path === '/healthz' || path === '/ready' || path === '/readyz';
        },
      },
      '@opentelemetry/instrumentation-pino': {
        disableLogSending: true,
      },
    }),
  ],
});

sdk.start();

export { sdk };
