import {
	getAllUsersWithLatestRecordDate,
	getUserPointContributionsForUsers,
	resetInactiveUserScores,
	updateUserRanks,
} from '@zeepkist/database/services'
import { batchProcess } from '../utils'
import { getPostgresErrorMetadata } from '../utils/postgresError'
import { recalculateAndPersistPlayerScore } from '../utils/recalculatePlayerScore'
import type { TaskHandler } from './types'

type Payload = Record<string, never>

interface PointsList {
	idUser: number
	points: number
}

const PLAYER_SCORE_BATCH_SIZE = 50
export const PLAYER_SCORE_WRITE_CONCURRENCY = 5

export const updatePlayerScores: TaskHandler<Payload> = async (_payload, helpers) => {
	const taskStartedAt = Date.now()
	helpers.logger.info('updatePlayerScores started.')
	try {
		await recalculatePlayerScores(helpers, taskStartedAt)
	} catch (error) {
		helpers.logger.error('updatePlayerScores failed.', {
			totalMs: Date.now() - taskStartedAt,
			postgres: getPostgresErrorMetadata(error),
		})
		throw error
	}
}

async function recalculatePlayerScores(
	helpers: Parameters<TaskHandler<Payload>>[1],
	taskStartedAt: number,
): Promise<void> {
	const unrankedCutoffDate = new Date()
	unrankedCutoffDate.setMonth(unrankedCutoffDate.getMonth() - 6)

	const discoveryStartedAt = Date.now()
	const users = await getAllUsersWithLatestRecordDate()
	if (users.length === 0) {
		helpers.logger.info('No users found with personal bests.', {
			discoveryMs: Date.now() - discoveryStartedAt,
			totalMs: Date.now() - taskStartedAt,
		})
		return
	}

	const unrankedUsers = users.filter(
		(user) => !user.latestRecordDate || new Date(user.latestRecordDate) < unrankedCutoffDate,
	)

	const rankedUsers = users.filter(
		(user) => user.latestRecordDate && new Date(user.latestRecordDate) >= unrankedCutoffDate,
	)
	helpers.logger.info('Discovered users for player-score recalculation.', {
		discoveryMs: Date.now() - discoveryStartedAt,
		totalUsers: users.length,
		rankedUsers: rankedUsers.length,
		unrankedUsers: unrankedUsers.length,
	})

	if (unrankedUsers.length > 0) {
		const inactiveStartedAt = Date.now()
		const idUsers = unrankedUsers.map((user) => user.idUser)
		const rankResetStartedAt = Date.now()
		await resetInactiveUserScores(idUsers)
		const rankResetMs = Date.now() - rankResetStartedAt
		helpers.logger.info('Reset inactive player scores.', {
			users: idUsers.length,
			rankResetMs,
			totalMs: Date.now() - inactiveStartedAt,
		})
	}

	const pointsList: PointsList[] = []

	const userBatches = Array.from(batchProcess(rankedUsers, PLAYER_SCORE_BATCH_SIZE))
	let processedUsers = 0
	for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
		const userBatch = userBatches[batchIndex]
		if (!userBatch) {
			continue
		}
		const batchStartedAt = Date.now()

		helpers.logger.info(
			`Updating player score batch ${batchIndex + 1}/${userBatches.length} (${userBatch.length} users).`,
		)

		const idUsers = userBatch.map(({ idUser }) => idUser)
		const contributionReadStartedAt = Date.now()
		const contributionsByUser = await getUserPointContributionsForUsers(idUsers)
		const contributionReadMs = Date.now() - contributionReadStartedAt

		const persistenceStartedAt = Date.now()
		try {
			for (const writeBatch of batchProcess(userBatch, PLAYER_SCORE_WRITE_CONCURRENCY)) {
				const results = await Promise.all(
					writeBatch.map(async ({ idUser }) => ({
						idUser,
						result: await recalculateAndPersistPlayerScore({
							idUser,
							initialContributions: contributionsByUser.get(idUser) ?? [],
							onSnapshotMismatch: (attempt) =>
								helpers.logger.warn(
									`Player contribution snapshot changed for idUser=${idUser}; retrying (${attempt}/3).`,
								),
						}),
					})),
				)
				for (const { idUser, result } of results) {
					pointsList.push({ idUser, points: result.points })
				}
			}
		} catch (error) {
			helpers.logger.error('Player score batch persistence failed.', {
				idUsers,
				persistenceMs: Date.now() - persistenceStartedAt,
				postgres: getPostgresErrorMetadata(error),
			})
			throw error
		}

		processedUsers += userBatch.length
		const totalMs = Date.now() - taskStartedAt
		const progress =
			rankedUsers.length === 0 ? 100 : (processedUsers / rankedUsers.length) * 100
		const etaMs =
			processedUsers === 0
				? 0
				: Math.round((totalMs / processedUsers) * (rankedUsers.length - processedUsers))
		const batchMs = Date.now() - batchStartedAt
		helpers.logger.info(
			`Updated player score batch ${batchIndex + 1}/${userBatches.length} (${batchMs}ms).`,
			{
				batchMs,
				users: userBatch.length,
				processedUsers,
				totalUsers: rankedUsers.length,
				progress: Number(progress.toFixed(2)),
				etaMs,
				contributionReadMs,
				persistenceMs: Date.now() - persistenceStartedAt,
				totalMs,
			},
		)
	}

	const usersSortedByHighestPoints = pointsList.sort((a, b) => b.points - a.points)
	let currentRank = 1
	let previousPoints: number | undefined
	let actualRank = 1
	const rankUpdates: Array<{ idUser: number; rank: number }> = []

	for (let index = 0; index < usersSortedByHighestPoints.length; index++) {
		const userPoint = usersSortedByHighestPoints[index]
		if (!userPoint) {
			continue
		}

		if (previousPoints === undefined || previousPoints !== userPoint.points) {
			currentRank = actualRank
		}

		rankUpdates.push({ idUser: userPoint.idUser, rank: currentRank })
		previousPoints = userPoint.points
		actualRank++
	}

	const rankUpdateStartedAt = Date.now()
	await updateUserRanks(rankUpdates, (processed, total) => {
		helpers.logger.info('Updated player rank batch.', {
			processedUsers: processed,
			progress: total === 0 ? 100 : Number(((processed / total) * 100).toFixed(2)),
			totalUsers: total,
		})
	})

	helpers.logger.info('updatePlayerScores completed.', {
		rankedUsers: rankUpdates.length,
		rankUpdateMs: Date.now() - rankUpdateStartedAt,
		totalMs: Date.now() - taskStartedAt,
	})
}
