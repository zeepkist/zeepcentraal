import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('server')
await import('./index')
