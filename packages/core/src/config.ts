import { z } from 'zod'

function parseDuration(input: string): number {
	if (/^\d+$/.test(input)) {
		return Number(input)
	}

	const match = input.match(/^(\d+)(ms|s|m|h|d)$/)
	if (!match) {
		throw new Error(`Invalid duration: ${input}`)
	}

	const [, rawValue, unit] = match
	const value = Number(rawValue)

	switch (unit) {
		case 'ms':
			return value
		case 's':
			return value * 1_000
		case 'm':
			return value * 60_000
		case 'h':
			return value * 3_600_000
		case 'd':
			return value * 86_400_000
		default:
			throw new Error(`Unsupported duration unit: ${unit}`)
	}
}

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	DATABASE_URL: z.string().min(1),
	HOST: z.string().default('0.0.0.0'),
	PORT: z.coerce.number().int().positive().default(3000),
	TRIGGER_JOB_TOKEN: z.string().min(1),
	JWT_SECRET: z.string().min(32),
	JWT_AUDIENCE: z.string().default('zeepki.st'),
	JWT_ISSUER: z.string().default('https://zeepki.st'),
	JWT_ACCESS_TTL: z.string().default('5m'),
	JWT_REFRESH_TTL: z.string().default('7d'),
	STEAM_APP_ID: z.string().default('1440670'),
	STEAM_API_KEY: z.string().optional(),
	DISCORD_CLIENT_ID: z.string().optional(),
	DISCORD_CLIENT_SECRET: z.string().optional(),
	DISCORD_REDIRECT_URI: z.string().optional(),
	FRONTEND_URL: z.string().default('http://localhost:5173'),
	BACKEND_URL: z.string().default('http://localhost:3000'),
	OPENTELEMETRY_SERVICE_NAME: z.string().default('zeepcentraal-api'),
	OPENTELEMETRY_COLLECTOR_URL: z.string().default('http://localhost:4317'),
})

const parsedEnv = envSchema.parse(process.env)

export const config = {
	nodeEnv: parsedEnv.NODE_ENV,
	databaseUrl: parsedEnv.DATABASE_URL,
	api: {
		host: parsedEnv.HOST,
		port: parsedEnv.PORT,
	},
	job: {
		triggerToken: parsedEnv.TRIGGER_JOB_TOKEN,
	},
	jwt: {
		secret: parsedEnv.JWT_SECRET,
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
	otel: {
		serviceName: parsedEnv.OPENTELEMETRY_SERVICE_NAME,
		collectorUrl: parsedEnv.OPENTELEMETRY_COLLECTOR_URL,
	},
} as const
