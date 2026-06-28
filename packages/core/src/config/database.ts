import { z } from 'zod'
import { type EnvSource, nodeEnvSchema, readRootEnvValue } from './shared'

const databaseEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/zeepkist'),
	WASABI_ACCESSKEY: z.string().default(''),
	WASABI_SECRETKEY: z.string().default(''),
	WASABI_BUCKET: z.string().default(''),
	WASABI_ENDPOINT: z.string().default(''),
	WASABI_REGION: z.string().default(''),
	GHOST_FOLDER: z.string().default('ghosts-dev'),
	THUMBNAIL_FOLDER: z.string().default('thumbnails-dev'),
	STEAM_API_KEY: z.string().optional(),
	OPENTELEMETRY_SERVICE_NAME: z.string().default('zeepcentraal'),
})

export function getDatabaseUrlForTooling(env: EnvSource = process.env): string {
	return (
		env.DATABASE_URL ??
		readRootEnvValue('DATABASE_URL') ??
		'postgres://postgres:postgres@localhost:5432/zeepkist'
	)
}

export function parseDatabaseConfig(env: EnvSource) {
	const parsedEnv = databaseEnvSchema.parse(env)

	return {
		nodeEnv: parsedEnv.NODE_ENV,
		databaseUrl: parsedEnv.DATABASE_URL,
		wasabi: {
			accessKey: parsedEnv.WASABI_ACCESSKEY,
			secretKey: parsedEnv.WASABI_SECRETKEY,
			bucket: parsedEnv.WASABI_BUCKET,
			endpoint: parsedEnv.WASABI_ENDPOINT,
			region: parsedEnv.WASABI_REGION,
			ghostFolder: parsedEnv.GHOST_FOLDER,
			thumbnailFolder: parsedEnv.THUMBNAIL_FOLDER,
		},
		steam: {
			apiKey: parsedEnv.STEAM_API_KEY,
		},
		otel: {
			serviceName: parsedEnv.OPENTELEMETRY_SERVICE_NAME,
		},
	} as const
}

export const databaseConfig = parseDatabaseConfig(process.env)
