import {
	bulkUpdateUserRanks,
	getAllUsersWithLatestRecordDate,
	getUsersPersonalBestsWithLevelPointsAndPosition,
	updateUserRanks,
	upsertUserPointsBulk,
} from '@zeepkist/database'
import { batchProcess, calculatePlayerPoints } from '../utils'
import type { TaskHandler } from './types'

type Payload = Record<string, never>

interface PointsList {
	idUser: number
	points: number
}

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
		await bulkUpdateUserRanks({
			idUsers: unrankedUsers.map((user) => user.idUser),
			points: 0,
			rank: -1,
		})
	}

	const pointsList: PointsList[] = []
	for (const userBatch of batchProcess(rankedUsers)) {
		const personalBestsByUser = await getUsersPersonalBestsWithLevelPointsAndPosition(
			userBatch.map(({ idUser }) => idUser),
		)
		const pointUpdates = userBatch.map(({ idUser }) => {
			const personalBests = personalBestsByUser.get(idUser) ?? []

			if (personalBests.length === 0) {
				pointsList.push({ idUser, points: 0 })
				return { idUser, points: 0, totalPoints: 0 }
			}

			const { points, totalPoints } = calculatePlayerPoints(personalBests)
			pointsList.push({ idUser, points })
			return { idUser, points, totalPoints }
		})
		await upsertUserPointsBulk(pointUpdates)
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
