import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
} from '@zeepkist/database'
import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from '../priorities'
import {
	createLevelScoreBatchJobs,
	LEVEL_SCORE_QUEUE_NAMES,
} from '../utils/createLevelScoreBatchJobs'
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
	if (payload.reportOnly) {
		return
	}

	const runId = crypto.randomUUID()
	await helpers.addJob(
		'updateLevelScoresBarrier',
		{
			runId,
			phase: 'queue0',
			all,
			...(!all && { ids: levelIds }),
		},
		{
			jobKey: `update-level-scores-barrier:${runId}:queue0`,
			priority: all ? DEFAULT_JOB_PRIORITY : PRIORITY_JOB_PRIORITY,
			queueName: LEVEL_SCORE_QUEUE_NAMES[0],
		},
	)
	helpers.logger.info(`Queued level score finalization barrier for run ${runId}.`)
}
