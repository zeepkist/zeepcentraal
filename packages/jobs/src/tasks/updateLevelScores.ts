import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	getPersonalBestCount90thPercentile,
	rebuildPlayerSkillAggregates,
} from '@zeepkist/database'
import { createLevelScoreBatchJobs } from '../utils/createLevelScoreBatchJobs'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
	reportOnly?: boolean
}

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	if (all) {
		helpers.logger.info('Rebuilding independent player-skill aggregates.')
		const rebuilt = await rebuildPlayerSkillAggregates()
		helpers.logger.info(`Rebuilt independent player skill for ${rebuilt} players.`)
	}
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(new Date(Date.now() - 20 * 60 * 1000))

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`)
	if (levelIds.length === 0) {
		return
	}

	const personalBestCountPercentile = await getPersonalBestCount90thPercentile()
	const jobs = createLevelScoreBatchJobs(
		levelIds,
		personalBestCountPercentile,
		payload.reportOnly,
		!all && !payload.reportOnly,
	)
	await helpers.addJobs(jobs)

	helpers.logger.info(`Queued ${jobs.length} updateLevelScoresBatch jobs.`)
}
