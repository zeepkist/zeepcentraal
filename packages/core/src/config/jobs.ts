import ms from 'ms'
import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const DATABASE_CONNECT_TIMEOUT_MS_DEFAULT = ms('5s')
const DATABASE_STATEMENT_TIMEOUT_MS_DEFAULT = ms('5m')
const DATABASE_LOCK_TIMEOUT_MS_DEFAULT = ms('30s')
const DATABASE_IDLE_TRANSACTION_TIMEOUT_MS_DEFAULT = ms('1m')

const jobsEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/zeepkist'),
	DATABASE_CONNECT_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(DATABASE_CONNECT_TIMEOUT_MS_DEFAULT),
	DATABASE_STATEMENT_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(DATABASE_STATEMENT_TIMEOUT_MS_DEFAULT),
	DATABASE_LOCK_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(DATABASE_LOCK_TIMEOUT_MS_DEFAULT),
	DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(DATABASE_IDLE_TRANSACTION_TIMEOUT_MS_DEFAULT),
	JOBS_QUEUE_POOL_MAX: z.coerce.number().int().positive().default(2),
	STEAM_APP_ID: z.string().default('1440670'),
	STEAM_API_KEY: z.string().optional(),
	STEAMCMD_PATH: z.string().default('steamcmd'),
	GHOST_FOLDER: z.string().default('ghosts-dev'),
	THUMBNAIL_FOLDER: z.string().default('thumbnails-dev'),
})

export function parseJobsConfig(env: EnvSource) {
	const parsedEnv = jobsEnvSchema.parse(env)

	return {
		nodeEnv: parsedEnv.NODE_ENV,
		databaseUrl: parsedEnv.DATABASE_URL,
		databaseTimeouts: {
			connectMs: parsedEnv.DATABASE_CONNECT_TIMEOUT_MS,
			statementMs: parsedEnv.DATABASE_STATEMENT_TIMEOUT_MS,
			lockMs: parsedEnv.DATABASE_LOCK_TIMEOUT_MS,
			idleTransactionMs: parsedEnv.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
		},
		queuePoolMax: parsedEnv.JOBS_QUEUE_POOL_MAX,
		steam: {
			appId: parsedEnv.STEAM_APP_ID,
			apiKey: parsedEnv.STEAM_API_KEY,
			cmdPath: parsedEnv.STEAMCMD_PATH,
		},
		wasabi: {
			ghostFolder: parsedEnv.GHOST_FOLDER,
			thumbnailFolder: parsedEnv.THUMBNAIL_FOLDER,
		},
	} as const
}

export const jobsConfig = parseJobsConfig(process.env)
