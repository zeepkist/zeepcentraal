import { resolve } from 'node:path'
import { z } from 'zod'
import { getDatabaseUrlForTooling } from './database'
import { type EnvSource, resolveConfiguredPath } from './shared'

const migrateEnvSchema = z.object({
	MIGRATIONS_FOLDER: z.string().optional(),
})

export function parseMigrateConfig(env: EnvSource) {
	const parsedEnv = migrateEnvSchema.parse(env)

	return {
		databaseUrl: getDatabaseUrlForTooling(env),
		migrationsFolder: resolveConfiguredPath({
			value: parsedEnv.MIGRATIONS_FOLDER,
			candidates: [
				resolve(process.cwd(), 'drizzle'),
				resolve(process.cwd(), 'packages/database/drizzle'),
			],
		}),
	} as const
}

export const migrateConfig = parseMigrateConfig(process.env)
