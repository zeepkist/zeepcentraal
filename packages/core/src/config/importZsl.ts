import { resolve } from 'node:path'
import { z } from 'zod'
import { type EnvSource, resolveConfiguredPath } from './shared'

const importZslEnvSchema = z.object({
	SUPER_LEAGUE_DATA_PATH: z.string().optional(),
})

export function parseImportZslConfig(env: EnvSource) {
	const parsedEnv = importZslEnvSchema.parse(env)

	return {
		superLeagueData: resolveConfiguredPath({
			value: parsedEnv.SUPER_LEAGUE_DATA_PATH,
			candidates: [
				'/data/super_league_data',
				resolve(process.cwd(), 'super_league_data'),
				resolve(process.cwd(), '../../super_league_data'),
			],
		}),
	} as const
}

export const importZslConfig = parseImportZslConfig(process.env)
