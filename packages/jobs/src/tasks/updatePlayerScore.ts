import { getPostgresErrorMetadata } from '../utils/postgresError'
import { recalculateAndPersistPlayerScore } from '../utils/recalculatePlayerScore'
import type { TaskHandler } from './types'

type Payload = {
	idUser?: number
}

export const updatePlayerScore: TaskHandler<Payload> = async (payload, helpers) => {
	if (!payload.idUser) {
		helpers.logger.warn('updatePlayerScore skipped: missing idUser payload.')
		return
	}
	const taskStartedAt = Date.now()
	helpers.logger.info(`updatePlayerScore started for idUser=${payload.idUser}.`)

	try {
		await recalculateAndPersistPlayerScore({
			idUser: payload.idUser,
			onSnapshotMismatch: (attempt) =>
				helpers.logger.warn(
					`Player contribution snapshot changed for idUser=${payload.idUser}; retrying (${attempt}/3).`,
				),
		})
		helpers.logger.info(`updatePlayerScore completed for idUser=${payload.idUser}.`, {
			totalMs: Date.now() - taskStartedAt,
		})
	} catch (error) {
		helpers.logger.error(`Error updating player score for idUser=${payload.idUser}`, {
			idUsers: [payload.idUser],
			totalMs: Date.now() - taskStartedAt,
			postgres: getPostgresErrorMetadata(error),
		})
		throw error
	}
}
