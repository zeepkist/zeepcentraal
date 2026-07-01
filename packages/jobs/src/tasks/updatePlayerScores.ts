import {
	bulkUpdateUserRanks,
	clearUserPointContributions,
	getAllUsersWithLatestRecordDate,
	updateUserRanks,
	upsertUserPointContributionsBulk,
	upsertUserPointsBulk,
} from '@zeepkist/database/services'
import {
	getPersonalBestLevelIdsForUsers,
	type PersonalBestWithLevelPointsAndPosition,
} from '@zeepkist/database/services/personalBest'
import { batchProcess, calculatePlayerPoints, type PlayerPointContribution } from '../utils'
import { getCachedLevelLeaderboards } from '../utils/playerScoreLeaderboardCache'
import type { TaskHandler } from './types'

type Payload = Record<string, never>

interface PointsList {
	idUser: number
	points: number
}

interface ContributionUpdate {
	idUser: number
	contributions: PlayerPointContribution[]
}

const PLAYER_SCORE_BATCH_SIZE = 50

export const updatePlayerScores: TaskHandler<Payload> = async (_payload, helpers) => {
	const unrankedCutoffDate = new Date()
	unrankedCutoffDate.setMonth(unrankedCutoffDate.getMonth() - 6)

	const users = await getAllUsersWithLatestRecordDate()
	if (users.length === 0) {
		helpers.logger.info('No users found with personal bests.')
		return
	}

	const unrankedUsers = users.filter(
		(user) => !user.latestRecordDate || new Date(user.latestRecordDate) < unrankedCutoffDate,
	)

	const rankedUsers = users.filter(
		(user) => user.latestRecordDate && new Date(user.latestRecordDate) >= unrankedCutoffDate,
	)

	if (unrankedUsers.length > 0) {
		const idUsers = unrankedUsers.map((user) => user.idUser)
		await bulkUpdateUserRanks({
			idUsers,
			points: 0,
			rank: -1,
		})
		await clearUserPointContributions(idUsers)
	}

	const pointsList: PointsList[] = []

	const rankedUserBatches = Array.from(batchProcess(rankedUsers, PLAYER_SCORE_BATCH_SIZE))
	for (let batchIndex = 0; batchIndex < rankedUserBatches.length; batchIndex++) {
		const userBatch = rankedUserBatches[batchIndex]
		if (!userBatch) {
			continue
		}

		helpers.logger.info(
			`Updating player score batch ${batchIndex + 1}/${rankedUserBatches.length} (${userBatch.length} users).`,
		)

		const idUsers = userBatch.map(({ idUser }) => idUser)
		const idUserSet = new Set(idUsers)
		const personalBestsByUser = new Map<number, PersonalBestWithLevelPointsAndPosition[]>()
		const idLevels = await getPersonalBestLevelIdsForUsers(idUsers)
		const levelLeaderboards = await getCachedLevelLeaderboards({
			idLevels,
			logger: helpers.logger,
		})

		for (const rows of levelLeaderboards.values()) {
			for (const row of rows) {
				if (!idUserSet.has(row.idUser)) {
					continue
				}

				const entries = personalBestsByUser.get(row.idUser) ?? []
				entries.push(row)
				personalBestsByUser.set(row.idUser, entries)
			}
		}

		const contributionUpdates: ContributionUpdate[] = []
		const pointUpdates = userBatch.map(({ idUser }) => {
			const personalBests = personalBestsByUser.get(idUser) ?? []

			if (personalBests.length === 0) {
				pointsList.push({ idUser, points: 0 })
				contributionUpdates.push({ idUser, contributions: [] })
				return { idUser, points: 0, totalPoints: 0 }
			}

			const { points, totalPoints, contributions } = calculatePlayerPoints(personalBests)
			pointsList.push({ idUser, points })
			contributionUpdates.push({ idUser, contributions })

			return { idUser, points, totalPoints }
		})

		await Promise.all([
			upsertUserPointsBulk(pointUpdates),
			upsertUserPointContributionsBulk(contributionUpdates),
		])

		helpers.logger.info(
			`Updated player score batch ${batchIndex + 1}/${rankedUserBatches.length}.`,
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

	await updateUserRanks(rankUpdates)

	helpers.logger.info('updatePlayerScores completed.')
}
