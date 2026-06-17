import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

function resolvePath(value: string) {
	if (isAbsolute(value)) {
		return value
	}

	return resolve(process.cwd(), value)
}

function resolveSuperLeagueDataPath() {
	const configuredPath = process.env.SUPER_LEAGUE_DATA_PATH
	if (configuredPath) {
		return resolvePath(configuredPath)
	}

	const candidates = [
		'/data/super_league_data',
		resolve(process.cwd(), 'super_league_data'),
		resolve(process.cwd(), '../../super_league_data'),
	]

	const existingPath = candidates.find((candidate) => existsSync(candidate))
	return existingPath ?? candidates[0] ?? resolve(process.cwd(), 'super_league_data')
}

export const SUPER_LEAGUE_DATA = resolveSuperLeagueDataPath()
