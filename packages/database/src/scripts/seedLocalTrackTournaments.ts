import { databaseConfig } from '@zeepkist/core/config/database'
import { eq } from 'drizzle-orm'
import { closeDatabase, db } from '../client'
import { level } from '../schema'
import { seedLocalTrackTournaments } from '../services/trackTournament'
import {
	assertLocalTournamentSeedAllowed,
	LOCAL_TOURNAMENT_LEVEL_XX_HASH,
} from './localTrackTournamentSeed'

async function main() {
	assertLocalTournamentSeedAllowed(databaseConfig.nodeEnv, databaseConfig.databaseUrl)
	const [demoLevel] = await db
		.select({ id: level.id })
		.from(level)
		.where(eq(level.xxHash, LOCAL_TOURNAMENT_LEVEL_XX_HASH))
		.limit(1)
	if (!demoLevel) {
		throw new Error(`Local tournament level not found: ${LOCAL_TOURNAMENT_LEVEL_XX_HASH}`)
	}
	await seedLocalTrackTournaments(demoLevel.id)
	console.info(`Local weekly/monthly tournaments seeded for ${LOCAL_TOURNAMENT_LEVEL_XX_HASH}`)
}

if (import.meta.main) {
	main()
		.catch((error) => {
			console.error(error)
			process.exitCode = 1
		})
		.finally(closeDatabase)
}
