import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('lobby-host')
await import('./lobbyHostRuntime')
