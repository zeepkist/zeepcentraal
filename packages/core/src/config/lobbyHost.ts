import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const lobbyHostEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	ZEEPKIST_TOTW_HOST_ENABLED: z.stringbool().default(false),
	ZEEPKIST_ROOM_BROKER_URL: z.url().default('http://localhost:3001'),
	ZEEPKIST_ROOM_BROKER_TOKEN: z.string().min(32).optional(),
	ZEEPKIST_TOTW_ASSET_POLL_MS: z.coerce.number().int().min(5_000).default(30_000),
	ZEEPKIST_TOTW_RECONNECT_MAX_MS: z.coerce.number().int().min(5_000).default(60_000),
	ZEEPKIST_TOTW_ROUND_TIME_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
	OPENTELEMETRY_SERVICE_NAME: z.string().optional(),
	OPENTELEMETRY_SERVICE_VERSION: z.string().optional(),
	OPENTELEMETRY_COLLECTOR_URL: z.string().default('http://localhost:4317'),
})

export function parseLobbyHostConfig(env: EnvSource) {
	const parsed = lobbyHostEnvSchema.parse(env)
	if (parsed.ZEEPKIST_TOTW_HOST_ENABLED && !parsed.ZEEPKIST_ROOM_BROKER_TOKEN) {
		throw new Error('ZEEPKIST_ROOM_BROKER_TOKEN is required when TotW host is enabled')
	}
	return {
		enabled: parsed.ZEEPKIST_TOTW_HOST_ENABLED,
		brokerUrl: parsed.ZEEPKIST_ROOM_BROKER_URL.replace(/\/$/, ''),
		brokerToken: parsed.ZEEPKIST_ROOM_BROKER_TOKEN,
		assetPollMs: parsed.ZEEPKIST_TOTW_ASSET_POLL_MS,
		reconnectMaxMs: parsed.ZEEPKIST_TOTW_RECONNECT_MAX_MS,
		roundTimeSeconds: parsed.ZEEPKIST_TOTW_ROUND_TIME_SECONDS,
		nodeEnv: parsed.NODE_ENV,
		otel: {
			collectorUrl: parsed.OPENTELEMETRY_COLLECTOR_URL,
			serviceName: parsed.OPENTELEMETRY_SERVICE_NAME,
			serviceVersion: parsed.OPENTELEMETRY_SERVICE_VERSION,
		},
	} as const
}

export const lobbyHostConfig = parseLobbyHostConfig(process.env)
