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
	TRIGGER_JOB_TOKEN: z.string().min(1).optional(),
	JWT_SECRET: z.string().min(32).optional(),
	JWT_AUDIENCE: z.string().default('zeepki.st'),
	JWT_ISSUER: z.string().default('https://zeepki.st'),
	JWT_ACCESS_TTL: z.string().default('15m'),
	JWT_REFRESH_TTL: z.string().default('7d'),
	STEAM_APP_ID: z.string().default('1440670'),
	STEAM_API_KEY: z.string().optional(),
	DISCORD_CLIENT_ID: z.string().optional(),
	DISCORD_CLIENT_SECRET: z.string().optional(),
	DISCORD_REDIRECT_URI: z.string().optional(),
	FRONTEND_URL: z.string().default('http://localhost:5173'),
	BACKEND_URL: z.string().default('http://localhost:3000'),
	CORS_ALLOWED_ORIGINS: z.string().optional(),
	TRUST_PROXY: z.stringbool().default(false),
	RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(60),
	RATE_LIMIT_RECORD_PER_MINUTE: z.coerce.number().int().positive().default(120),
	RATE_LIMIT_MUTATION_PER_MINUTE: z.coerce.number().int().positive().default(300),
	RATE_LIMIT_JOB_PER_MINUTE: z.coerce.number().int().positive().default(60),
	OPENTELEMETRY_SERVICE_NAME: z.string().default('zeepcentraal-api'),
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

	if (!jwtSecret) {
		throw new Error('JWT_SECRET is required')
	}
	if (!triggerJobToken) {
		throw new Error('TRIGGER_JOB_TOKEN is required')
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
		discord: {
			clientId: parsedEnv.DISCORD_CLIENT_ID,
			clientSecret: parsedEnv.DISCORD_CLIENT_SECRET,
			redirectUri: parsedEnv.DISCORD_REDIRECT_URI,
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
			collectorUrl: parsedEnv.OPENTELEMETRY_COLLECTOR_URL,
		},
	} as const
}

export const serverConfig = parseServerConfig(process.env)
