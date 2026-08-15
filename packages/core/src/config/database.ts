import { z } from 'zod'
import { type EnvSource, nodeEnvSchema, readRootEnvValue } from './shared'

const databaseEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/zeepkist'),
	DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
	DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
	DATABASE_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
	DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
	WASABI_ACCESSKEY: z.string().default(''),
	WASABI_SECRETKEY: z.string().default(''),
	WASABI_BUCKET: z.string().default(''),
	WASABI_ENDPOINT: z.string().default(''),
	WASABI_REGION: z.string().default(''),
	GHOST_FOLDER: z.string().default('ghosts-dev'),
	THUMBNAIL_FOLDER: z.string().default('thumbnails-dev'),
	STEAM_API_KEY: z.string().optional(),
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
		databaseTimeouts: {
			connectMs: parsedEnv.DATABASE_CONNECT_TIMEOUT_MS,
			statementMs: parsedEnv.DATABASE_STATEMENT_TIMEOUT_MS,
			lockMs: parsedEnv.DATABASE_LOCK_TIMEOUT_MS,
			idleTransactionMs: parsedEnv.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
		},
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
	} as const
}

export const databaseConfig = parseDatabaseConfig(process.env)
