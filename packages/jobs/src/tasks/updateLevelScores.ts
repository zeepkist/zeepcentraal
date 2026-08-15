import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
} from '@zeepkist/database'
import { createLevelScoreBatchJobs } from '../utils/createLevelScoreBatchJobs'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
	reportOnly?: boolean
}

export const RECENT_LEVEL_SCORE_LOOKBACK_MS = 60 * 60 * 1000

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	if (all) {
		helpers.logger.info('Rebuilding independent player-skill aggregates.')
		const rebuilt = await rebuildPlayerSkillAggregates()
		helpers.logger.info(`Rebuilt independent player skill for ${rebuilt} players.`)
	}
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(
				new Date(Date.now() - RECENT_LEVEL_SCORE_LOOKBACK_MS),
			)

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`)
	if (levelIds.length === 0) {
		return
	}

	const jobs = createLevelScoreBatchJobs(
		levelIds,
		payload.reportOnly,
		!all && !payload.reportOnly,
	)
	await helpers.addJobs(jobs)

	helpers.logger.info(`Queued ${jobs.length} updateLevelScoresBatch jobs.`)
}
