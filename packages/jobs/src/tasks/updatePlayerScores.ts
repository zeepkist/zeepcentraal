import {
	getUserPointContributionsForUsers,
	getUsersWithLatestRecordDatePage,
	rankActiveUsersByPoints,
	resetInactiveUserScores,
} from '@zeepkist/database/services'
import { batchProcess, runWithConcurrency } from '../utils'
import { getPostgresErrorMetadata } from '../utils/postgresError'
import { recalculateAndPersistPlayerScore } from '../utils/recalculatePlayerScore'
import type { TaskHandler } from './types'

type Payload = Record<string, never>

const PLAYER_SCORE_BATCH_SIZE = 50
const PLAYER_SCORE_PAGE_SIZE = 200
const PLAYER_SCORE_CONCURRENCY = 4

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
	const rankedUserIds: number[] = []
	let totalUsers = 0
	let rankedUserCount = 0
	let unrankedUserCount = 0
	let processedUsers = 0
	let afterId = 0
	let pageIndex = 0
	while (true) {
		const userPage = await getUsersWithLatestRecordDatePage({
			afterId,
			limit: PLAYER_SCORE_PAGE_SIZE,
		})
		if (userPage.length === 0) break
		const unrankedUsers = userPage.filter(
			(user) =>
				!user.latestRecordDate || new Date(user.latestRecordDate) < unrankedCutoffDate,
		)
		const rankedUsers = userPage.filter(
			(user) =>
				user.latestRecordDate && new Date(user.latestRecordDate) >= unrankedCutoffDate,
		)
		totalUsers += userPage.length
		rankedUserCount += rankedUsers.length
		unrankedUserCount += unrankedUsers.length
		rankedUserIds.push(...rankedUsers.map(({ idUser }) => idUser))
		helpers.logger.info('Discovered users for player-score recalculation.', {
			discoveryMs: Date.now() - discoveryStartedAt,
			page: pageIndex + 1,
			totalUsers,
			rankedUsers: rankedUserCount,
			unrankedUsers: unrankedUserCount,
		})

		if (unrankedUsers.length > 0) {
			const inactiveStartedAt = Date.now()
			const idUsers = unrankedUsers.map((user) => user.idUser)
			const rankResetStartedAt = Date.now()
			await resetInactiveUserScores(idUsers)
			helpers.logger.info('Reset inactive player scores.', {
				users: idUsers.length,
				rankResetMs: Date.now() - rankResetStartedAt,
				totalMs: Date.now() - inactiveStartedAt,
			})
		}

		const userBatches = Array.from(batchProcess(rankedUsers, PLAYER_SCORE_BATCH_SIZE))
		await runWithConcurrency(
			userBatches,
			PLAYER_SCORE_CONCURRENCY,
			async (userBatch, batchIndex) => {
				const batchStartedAt = Date.now()

				helpers.logger.info(
					`Updating player score page ${pageIndex + 1}, batch ${batchIndex + 1}/${userBatches.length} (${userBatch.length} users).`,
				)

				const idUsers = userBatch.map(({ idUser }) => idUser)
				const contributionReadStartedAt = Date.now()
				const contributionsByUser = await getUserPointContributionsForUsers(idUsers)
				const contributionReadMs = Date.now() - contributionReadStartedAt

				const persistenceStartedAt = Date.now()
				try {
					for (const writeBatch of batchProcess(userBatch, PLAYER_SCORE_CONCURRENCY)) {
						await Promise.all(
							writeBatch.map(async ({ idUser }) =>
								recalculateAndPersistPlayerScore({
									idUser,
									initialContributions: contributionsByUser.get(idUser) ?? [],
									onSnapshotMismatch: (attempt) =>
										helpers.logger.warn(
											`Player contribution snapshot changed for idUser=${idUser}; retrying (${attempt}/3).`,
										),
								}),
							),
						)
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
				const batchMs = Date.now() - batchStartedAt
				helpers.logger.info(
					`Updated player score page ${pageIndex + 1}, batch ${batchIndex + 1}/${userBatches.length} (${batchMs}ms).`,
					{
						batchMs,
						users: userBatch.length,
						processedUsers,
						totalUsers,
						contributionReadMs,
						persistenceMs: Date.now() - persistenceStartedAt,
						totalMs,
					},
				)
			},
		)
		afterId = userPage.at(-1)?.idUser ?? afterId
		const finished = userPage.length < PLAYER_SCORE_PAGE_SIZE
		userBatches.length = 0
		rankedUsers.length = 0
		unrankedUsers.length = 0
		userPage.length = 0
		pageIndex++
		if (finished) break
	}
	if (totalUsers === 0) {
		helpers.logger.info('No users found with personal bests.', {
			discoveryMs: Date.now() - discoveryStartedAt,
			totalMs: Date.now() - taskStartedAt,
		})
		return
	}

	const rankUpdateStartedAt = Date.now()
	const rankChanges = await rankActiveUsersByPoints(rankedUserIds.splice(0))

	helpers.logger.info('updatePlayerScores completed.', {
		rankedUsers: rankedUserCount,
		rankChanges,
		rankUpdateMs: Date.now() - rankUpdateStartedAt,
		totalMs: Date.now() - taskStartedAt,
	})
}
