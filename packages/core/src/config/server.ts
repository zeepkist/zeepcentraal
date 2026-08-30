import { z } from 'zod'
import {
	type EnvSource,
	nodeEnvSchema,
	parseDuration,
	requireStrongProductionSecrets,
} from './shared'

const serverEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	HOST: z.string().default('0.0.0.0'),
	PORT: z.coerce.number().int().positive().default(3000),
	SERVER_MAX_REQUEST_BODY_SIZE: z.coerce
		.number()
		.int()
		.positive()
		.default(32 * 1024 * 1024),
	TRIGGER_JOB_TOKEN: z.string().min(1).optional(),
	JWT_SECRET: z.string().min(32).optional(),
	JWT_AUDIENCE: z.string().default('zeepki.st'),
	JWT_ISSUER: z.string().default('https://zeepki.st'),
	JWT_ACCESS_TTL: z.string().default('15m'),
	JWT_REFRESH_TTL: z.string().default('7d'),
	STEAM_APP_ID: z.coerce.number().int().positive().default(1_440_670),
	STEAM_API_KEY: z.string().optional(),
	ZEEPKIST_LOBBY_ENABLED: z.stringbool().default(false),
	ZEEPKIST_LOBBY_HOST: z.string().min(1).optional(),
	ZEEPKIST_LOBBY_PORT: z.coerce.number().int().min(1).max(65535).optional(),
	ZEEPKIST_LOBBY_BUILD: z.coerce.number().int().positive().optional(),
	ZEEPKIST_STEAM_REFRESH_TOKEN_FILE: z.string().min(1).default(''),
	ZEEPKIST_ROOM_BROKER_ENABLED: z.stringbool().default(false),
	ZEEPKIST_ROOM_BROKER_HOST: z.string().min(1).default('0.0.0.0'),
	ZEEPKIST_ROOM_BROKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
	ZEEPKIST_ROOM_BROKER_TOKEN: z.string().min(32).optional(),
	DISCORD_CLIENT_ID: z.string().optional(),
	DISCORD_CLIENT_SECRET: z.string().optional(),
	DISCORD_REDIRECT_URI: z.string().optional(),
	DISCORD_BOT_API_TOKEN: z.string().min(32).optional(),
	FRONTEND_URL: z.string().default('http://localhost:4000'),
	BACKEND_URL: z.string().default('http://localhost:3000'),
	CORS_ALLOWED_ORIGINS: z.string().optional(),
	TRUST_PROXY: z.stringbool().default(false),
	RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(60),
	RATE_LIMIT_RECORD_PER_MINUTE: z.coerce.number().int().positive().default(120),
	RATE_LIMIT_MUTATION_PER_MINUTE: z.coerce.number().int().positive().default(300),
	RATE_LIMIT_JOB_PER_MINUTE: z.coerce.number().int().positive().default(60),
	OPENTELEMETRY_SERVICE_NAME: z.string().optional(),
	OPENTELEMETRY_SERVICE_VERSION: z.string().optional(),
	OPENTELEMETRY_COLLECTOR_URL: z.string().default('http://localhost:4317'),
})

export function parseServerConfig(env: EnvSource) {
	const parsedEnv = serverEnvSchema.parse(env)
	const jwtSecret =
		parsedEnv.JWT_SECRET ??
		(parsedEnv.NODE_ENV === 'test' ? 'x'.repeat(32) : parsedEnv.JWT_SECRET)
	const triggerJobToken =
		parsedEnv.TRIGGER_JOB_TOKEN ??
		(parsedEnv.NODE_ENV === 'test' ? 'trigger-token' : parsedEnv.TRIGGER_JOB_TOKEN)
	const discordBotApiToken =
		parsedEnv.DISCORD_BOT_API_TOKEN ??
		(parsedEnv.NODE_ENV === 'test' ? 'discord-bot-api-token'.padEnd(32, 'x') : undefined)

	if (!jwtSecret) {
		throw new Error('JWT_SECRET is required')
	}
	if (!triggerJobToken) {
		throw new Error('TRIGGER_JOB_TOKEN is required')
	}
	if (!discordBotApiToken) {
		throw new Error('DISCORD_BOT_API_TOKEN is required')
	}
	if (parsedEnv.ZEEPKIST_LOBBY_ENABLED && !parsedEnv.ZEEPKIST_LOBBY_HOST) {
		throw new Error('ZEEPKIST_LOBBY_HOST is required when lobby feed is enabled')
	}
	if (parsedEnv.ZEEPKIST_LOBBY_ENABLED && !parsedEnv.ZEEPKIST_LOBBY_BUILD) {
		throw new Error('ZEEPKIST_LOBBY_BUILD is required when lobby feed is enabled')
	}
	if (parsedEnv.ZEEPKIST_ROOM_BROKER_ENABLED && !parsedEnv.ZEEPKIST_LOBBY_ENABLED) {
		throw new Error('ZEEPKIST_LOBBY_ENABLED is required when room broker is enabled')
	}
	if (parsedEnv.ZEEPKIST_ROOM_BROKER_ENABLED && !parsedEnv.ZEEPKIST_ROOM_BROKER_TOKEN) {
		throw new Error('ZEEPKIST_ROOM_BROKER_TOKEN is required when room broker is enabled')
	}

	requireStrongProductionSecrets({
		nodeEnv: parsedEnv.NODE_ENV,
		jwtSecret,
		triggerJobToken,
	})

	return {
		nodeEnv: parsedEnv.NODE_ENV,
		api: {
			host: parsedEnv.HOST,
			port: parsedEnv.PORT,
			maxRequestBodySize: parsedEnv.SERVER_MAX_REQUEST_BODY_SIZE,
		},
		job: {
			triggerToken: triggerJobToken,
		},
		jwt: {
			secret: jwtSecret,
			audience: parsedEnv.JWT_AUDIENCE,
			issuer: parsedEnv.JWT_ISSUER,
			accessTtlMs: parseDuration(parsedEnv.JWT_ACCESS_TTL),
			refreshTtlMs: parseDuration(parsedEnv.JWT_REFRESH_TTL),
		},
		steam: {
			appId: parsedEnv.STEAM_APP_ID,
			apiKey: parsedEnv.STEAM_API_KEY,
		},
		lobby: {
			enabled: parsedEnv.ZEEPKIST_LOBBY_ENABLED,
			host: parsedEnv.ZEEPKIST_LOBBY_HOST,
			port: parsedEnv.ZEEPKIST_LOBBY_PORT,
			build: parsedEnv.ZEEPKIST_LOBBY_BUILD,
			refreshTokenFile: parsedEnv.ZEEPKIST_STEAM_REFRESH_TOKEN_FILE,
			broker: {
				enabled: parsedEnv.ZEEPKIST_ROOM_BROKER_ENABLED,
				host: parsedEnv.ZEEPKIST_ROOM_BROKER_HOST,
				port: parsedEnv.ZEEPKIST_ROOM_BROKER_PORT,
				token: parsedEnv.ZEEPKIST_ROOM_BROKER_TOKEN,
			},
		},
		discord: {
			clientId: parsedEnv.DISCORD_CLIENT_ID,
			clientSecret: parsedEnv.DISCORD_CLIENT_SECRET,
			redirectUri: parsedEnv.DISCORD_REDIRECT_URI,
			botApiToken: discordBotApiToken,
		},
		frontendUrl: parsedEnv.FRONTEND_URL,
		backendUrl: parsedEnv.BACKEND_URL,
		http: {
			corsAllowedOrigins: (parsedEnv.CORS_ALLOWED_ORIGINS ?? parsedEnv.FRONTEND_URL)
				.split(',')
				.map((origin) => origin.trim())
				.filter(Boolean),
			trustProxy: parsedEnv.TRUST_PROXY,
			rateLimits: {
				auth: parsedEnv.RATE_LIMIT_AUTH_PER_MINUTE,
				record: parsedEnv.RATE_LIMIT_RECORD_PER_MINUTE,
				mutation: parsedEnv.RATE_LIMIT_MUTATION_PER_MINUTE,
				job: parsedEnv.RATE_LIMIT_JOB_PER_MINUTE,
			},
		},
		otel: {
			serviceName: parsedEnv.OPENTELEMETRY_SERVICE_NAME,
			serviceVersion: parsedEnv.OPENTELEMETRY_SERVICE_VERSION,
			collectorUrl: parsedEnv.OPENTELEMETRY_COLLECTOR_URL,
		},
	} as const
}

export const serverConfig = parseServerConfig(process.env)
