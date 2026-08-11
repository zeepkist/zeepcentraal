import {
	calculatePlayerPointsFromContributions,
	type PlayerPointContribution,
} from '@zeepkist/core/score'
import {
	getAllUsersWithLatestRecordDate,
	getUserPointContributionsForUsers,
	resetInactiveUserScores,
	updateUserPointContributionPlayerValuesBulk,
	updateUserRanks,
	upsertUserPointsBulk,
} from '@zeepkist/database/services'
import { batchProcess } from '../utils'
import { getPostgresErrorMetadata } from '../utils/postgresError'
import type { TaskHandler } from './types'

type Payload = Record<string, never>

interface PointsList {
	idUser: number
	points: number
}

interface ContributionUpdate {
	contributions: PlayerPointContribution[]
	idUser: number
}

const PLAYER_SCORE_BATCH_SIZE = 50

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
	const rankedUserIds = new Set(rankedUsers.map((user) => user.idUser))

	const userBatches = Array.from(batchProcess(rankedUsers, PLAYER_SCORE_BATCH_SIZE))
	for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
		const userBatch = userBatches[batchIndex]
		if (!userBatch) {
			continue
		}

		helpers.logger.info(
			`Updating player score batch ${batchIndex + 1}/${userBatches.length} (${userBatch.length} users).`,
		)

		const idUsers = userBatch.map(({ idUser }) => idUser)
		const contributionReadStartedAt = Date.now()
		const contributionsByUser = await getUserPointContributionsForUsers(idUsers)
		const contributionReadMs = Date.now() - contributionReadStartedAt

		const calculationStartedAt = Date.now()
		const contributionUpdates: ContributionUpdate[] = []
		const pointUpdates: Array<{ idUser: number; points: number; totalPoints: number }> = []
		for (const { idUser } of userBatch) {
			const sourceContributions = contributionsByUser.get(idUser) ?? []
			const { points, totalPoints, contributions } =
				calculatePlayerPointsFromContributions(sourceContributions)
			contributionUpdates.push({ idUser, contributions })

			if (rankedUserIds.has(idUser)) {
				pointsList.push({ idUser, points })
				pointUpdates.push({ idUser, points, totalPoints })
			}
		}

		const calculationMs = Date.now() - calculationStartedAt
		const persistenceStartedAt = Date.now()
		let contributionPersistenceMs = 0
		let userPointsPersistenceMs = 0
		try {
			await Promise.all([
				(async () => {
					const startedAt = Date.now()
					await upsertUserPointsBulk(pointUpdates)
					userPointsPersistenceMs = Date.now() - startedAt
				})(),
				(async () => {
					const startedAt = Date.now()
					await updateUserPointContributionPlayerValuesBulk(contributionUpdates)
					contributionPersistenceMs = Date.now() - startedAt
				})(),
			])
		} catch (error) {
			helpers.logger.error('Player score batch persistence failed.', {
				idUsers,
				persistenceMs: Date.now() - persistenceStartedAt,
				postgres: getPostgresErrorMetadata(error),
			})
			throw error
		}

		helpers.logger.info(`Updated player score batch ${batchIndex + 1}/${userBatches.length}.`, {
			users: userBatch.length,
			contributionReadMs,
			calculationMs,
			userPointsPersistenceMs,
			contributionPersistenceMs,
			persistenceMs: Date.now() - persistenceStartedAt,
			totalMs: Date.now() - taskStartedAt,
		})
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
	await updateUserRanks(rankUpdates)

	helpers.logger.info('updatePlayerScores completed.', {
		rankedUsers: rankUpdates.length,
		rankUpdateMs: Date.now() - rankUpdateStartedAt,
		totalMs: Date.now() - taskStartedAt,
	})
}
