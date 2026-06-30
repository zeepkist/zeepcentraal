import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const jobsEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/zeepkist'),
	STEAM_APP_ID: z.string().default('1440670'),
	STEAM_API_KEY: z.string().optional(),
	STEAMCMD_PATH: z.string().default('steamcmd'),
	STEAMCMD_HOME: z.string().optional(),
	STEAMCMD_USERNAME: z.string().optional(),
	STEAMCMD_PASSWORD: z.string().optional(),
	STEAMCMD_SHARED_SECRET: z.string().optional(),
	GHOST_FOLDER: z.string().default('ghosts-dev'),
	THUMBNAIL_FOLDER: z.string().default('thumbnails-dev'),
})

export function parseJobsConfig(env: EnvSource) {
	const parsedEnv = jobsEnvSchema.parse(env)

	return {
		nodeEnv: parsedEnv.NODE_ENV,
		databaseUrl: parsedEnv.DATABASE_URL,
		steam: {
			appId: parsedEnv.STEAM_APP_ID,
			apiKey: parsedEnv.STEAM_API_KEY,
			cmdPath: parsedEnv.STEAMCMD_PATH,
			home: parsedEnv.STEAMCMD_HOME,
			username: parsedEnv.STEAMCMD_USERNAME,
			password: parsedEnv.STEAMCMD_PASSWORD,
			sharedSecret: parsedEnv.STEAMCMD_SHARED_SECRET,
		},
		wasabi: {
			ghostFolder: parsedEnv.GHOST_FOLDER,
			thumbnailFolder: parsedEnv.THUMBNAIL_FOLDER,
		},
	} as const
}

export const jobsConfig = parseJobsConfig(process.env)
