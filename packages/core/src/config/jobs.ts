import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const jobsEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/zeepkist'),
	KEYV_SCHEMA: z.string().min(1).default('zeepkist_cache'),
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
		keyvSchema: parsedEnv.KEYV_SCHEMA,
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
