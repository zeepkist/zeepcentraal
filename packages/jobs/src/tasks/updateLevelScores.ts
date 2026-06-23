import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	getPersonalBestCount90thPercentile,
} from '@zeepkist/database'
import { createLevelScoreBatchJobs } from '../utils/createLevelScoreBatchJobs'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
}

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(new Date(Date.now() - 20 * 60 * 1000))

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`)
	if (levelIds.length === 0) {
		return
	}

	const personalBestCountPercentile = await getPersonalBestCount90thPercentile()
	const jobs = createLevelScoreBatchJobs(levelIds, personalBestCountPercentile)
	await helpers.addJobs(jobs)

	helpers.logger.info(`Queued ${jobs.length} updateLevelScoresBatch jobs.`)
}
