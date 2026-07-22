export const LOCAL_TOURNAMENT_LEVEL_XX_HASH = 'F8511064F7872275D56591AB4F3BCA06'
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function assertLocalTournamentSeedAllowed(nodeEnv: string, databaseUrl: string): void {
	if (nodeEnv === 'production')
		throw new Error('Local tournament seed is forbidden in production')
	const hostname = new URL(databaseUrl).hostname
	if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
		throw new Error(`Local tournament seed requires localhost database; received ${hostname}`)
	}
}
